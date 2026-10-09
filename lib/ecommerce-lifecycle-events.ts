import { database } from '../db/raw.ts';
import { fixedBusinessName, stateSchema, type Order, type State } from './crm.ts';
import { hmacSha256Hex, sha256Hex } from './ecommerce-integration.ts';

type LifecycleRow={
  id:string;
  owner_id:string;
  order_id:string;
  event_key:string;
  recipient:string;
  state:string;
  attempts:number;
  next_attempt_at:string|null;
  created_at:string;
};

const MAX_ATTEMPTS=7;
const PATH='/api/integrations/crm/lifecycle';

function enabled(){
  return process.env.ECOMMERCE_LIFECYCLE_EVENTS_ENABLED==='1';
}

function configured(){
  return Boolean(
    enabled() &&
    (process.env.PUBLIC_STOREFRONT_URL||'').trim() &&
    (process.env.ECOMMERCE_INTEGRATION_ID||'').trim() &&
    (process.env.ECOMMERCE_INTEGRATION_SECRET||'').trim()
  );
}

export async function ensureEcommerceLifecycleOutbox(){
  const db=database();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS crm_ecommerce_lifecycle_outbox ("+
    "id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,order_id TEXT NOT NULL,event_key TEXT NOT NULL,"+
    "recipient TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT,"+
    "last_error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,sent_at TEXT,"+
    "UNIQUE(owner_id,order_id,event_key))"
  ).run();
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS crm_ecommerce_lifecycle_due_idx ON crm_ecommerce_lifecycle_outbox(state,next_attempt_at,created_at)'
  ).run();
}

function deliveryTransition(before:Order,after:Order){
  return (
    before.channel==='Website' &&
    after.channel==='Website' &&
    before.status!=='Delivered' &&
    after.status==='Delivered' &&
    Boolean(after.delivered)
  );
}

export async function ecommerceLifecycleStatusChangeStatements(
  ownerId:string,
  before:Order,
  after:Order,
  now:string
){
  if(!enabled()||!deliveryTransition(before,after))return [];
  await ensureEcommerceLifecycleOutbox();
  const db=database(),id=crypto.randomUUID();
  return [
    db.prepare(
      "INSERT INTO crm_ecommerce_lifecycle_outbox "+
      "(id,owner_id,order_id,event_key,recipient,state,attempts,next_attempt_at,last_error,created_at,updated_at,sent_at) "+
      "SELECT ?,?,?,?,COALESCE(c.email,''),CASE WHEN COALESCE(c.email,'')='' THEN 'skipped' ELSE 'queued' END,0,"+
      "CASE WHEN COALESCE(c.email,'')='' THEN NULL ELSE ? END,"+
      "CASE WHEN COALESCE(c.email,'')='' THEN 'Website order has no customer email.' ELSE '' END,?,?,NULL "+
      "FROM (SELECT 1) seed LEFT JOIN crm_ecommerce_order_contacts c ON c.owner_id=? AND c.order_id=? "+
      "ON CONFLICT(owner_id,order_id,event_key) DO NOTHING"
    ).bind(
      id,ownerId,after.id,'order.delivered',
      now,now,now,ownerId,after.id
    )
  ];
}

async function workspaceState(ownerId:string){
  const row=await database().prepare(
    'SELECT data FROM crm_workspaces WHERE owner_id=?'
  ).bind(ownerId).first<{data:string}>();
  if(!row)return null;
  return fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
}

function eventPayload(state:State,order:Order,row:LifecycleRow){
  if(
    order.channel!=='Website' ||
    !order.delivered ||
    ['Returned','Cancelled'].includes(order.status)
  )return null;
  return {
    eventId:row.id,
    type:'order.delivered' as const,
    email:row.recipient,
    deliveredAt:order.delivered,
    items:order.items.map(item=>({
      category:state.products.find(product=>product.id===item.productId)?.category||'',
      qty:item.qty
    }))
  };
}

async function sendLifecycleEvent(row:LifecycleRow,payload:ReturnType<typeof eventPayload>){
  if(!payload)throw new Error('LIFECYCLE_EVENT_NOT_APPLICABLE');
  const base=(process.env.PUBLIC_STOREFRONT_URL||'').trim().replace(/\/$/,'');
  const integrationId=(process.env.ECOMMERCE_INTEGRATION_ID||'').trim();
  const secret=process.env.ECOMMERCE_INTEGRATION_SECRET||'';
  if(!base||!integrationId||!secret)throw new Error('LIFECYCLE_INTEGRATION_NOT_CONFIGURED');

  const body=JSON.stringify(payload);
  const timestamp=String(Date.now());
  const nonce=crypto.randomUUID().replace(/-/g,'');
  const bodyHash=await sha256Hex(body);
  const canonical=[
    'POST',
    PATH,
    integrationId,
    timestamp,
    nonce,
    bodyHash
  ].join('\n');
  const signature=await hmacSha256Hex(secret,canonical);

  const response=await fetch(base+PATH,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-aloyri-integration':integrationId,
      'x-aloyri-timestamp':timestamp,
      'x-aloyri-nonce':nonce,
      'x-aloyri-signature':signature
    },
    body,
    cache:'no-store',
    signal:AbortSignal.timeout(10_000)
  });
  const text=await response.text();
  if(!response.ok)throw new Error('LIFECYCLE_HTTP_'+response.status+':'+text.slice(0,240));
}

function retryAt(attempt:number){
  const minutes=[1,5,15,60,240,720,1440][Math.max(0,Math.min(6,attempt-1))];
  return new Date(Date.now()+minutes*60_000).toISOString();
}

export async function processDueEcommerceLifecycleEvents(input:{ownerId?:string;limit?:number}={}){
  await ensureEcommerceLifecycleOutbox();
  const db=database(),now=new Date().toISOString(),limit=Math.max(1,Math.min(50,input.limit||20));
  const ownerClause=input.ownerId?' AND owner_id=?':'';
  const pending=await db.prepare(
    "SELECT COUNT(*) AS n FROM crm_ecommerce_lifecycle_outbox "+
    "WHERE state IN ('queued','failed') AND next_attempt_at IS NOT NULL AND next_attempt_at<=?"+ownerClause
  ).bind(now,...(input.ownerId?[input.ownerId]:[])).first<{n:number|string}>();

  if(!configured()){
    return {configured:false,pending:Number(pending?.n||0),processed:0,sent:0,failed:0};
  }

  await db.prepare(
    "UPDATE crm_ecommerce_lifecycle_outbox SET state='failed',next_attempt_at=?,last_error='Recovered interrupted send.',updated_at=? "+
    "WHERE state='sending' AND updated_at<?"
  ).bind(now,now,new Date(Date.now()-10*60_000).toISOString()).run();

  const due=await db.prepare(
    "SELECT id,owner_id,order_id,event_key,recipient,state,attempts,next_attempt_at,created_at "+
    "FROM crm_ecommerce_lifecycle_outbox WHERE state IN ('queued','failed') AND recipient<>'' "+
    "AND next_attempt_at IS NOT NULL AND next_attempt_at<=?"+ownerClause+
    ' ORDER BY created_at ASC LIMIT ?'
  ).bind(now,...(input.ownerId?[input.ownerId]:[]),limit).all<LifecycleRow>();

  let processed=0,sent=0,failed=0;
  const states=new Map<string,State|null>();
  for(const candidate of due.results){
    const claimed=await db.prepare(
      "UPDATE crm_ecommerce_lifecycle_outbox SET state='sending',attempts=attempts+1,updated_at=? "+
      "WHERE id=? AND state IN ('queued','failed') AND next_attempt_at IS NOT NULL AND next_attempt_at<=? "+
      "RETURNING id,owner_id,order_id,event_key,recipient,state,attempts,next_attempt_at,created_at"
    ).bind(new Date().toISOString(),candidate.id,new Date().toISOString()).first<LifecycleRow>();
    if(!claimed)continue;
    processed++;

    try{
      let state=states.get(claimed.owner_id);
      if(state===undefined){
        state=await workspaceState(claimed.owner_id);
        states.set(claimed.owner_id,state);
      }
      const order=state?.orders.find(item=>item.id===claimed.order_id);
      const payload=state&&order?eventPayload(state,order,claimed):null;
      if(!payload){
        await db.prepare(
          "UPDATE crm_ecommerce_lifecycle_outbox SET state='skipped',last_error=?,next_attempt_at=NULL,updated_at=? WHERE id=?"
        ).bind('Delivered website order is no longer eligible for lifecycle messaging.',new Date().toISOString(),claimed.id).run();
        continue;
      }
      await sendLifecycleEvent(claimed,payload);
      const finished=new Date().toISOString();
      await db.prepare(
        "UPDATE crm_ecommerce_lifecycle_outbox SET state='sent',last_error='',next_attempt_at=NULL,sent_at=?,updated_at=? WHERE id=?"
      ).bind(finished,finished,claimed.id).run();
      sent++;
    }catch(error){
      failed++;
      const message=error instanceof Error?error.message:'Lifecycle event delivery failed.';
      const exhausted=claimed.attempts>=MAX_ATTEMPTS;
      await db.prepare(
        "UPDATE crm_ecommerce_lifecycle_outbox SET state='failed',last_error=?,next_attempt_at=?,updated_at=? WHERE id=?"
      ).bind(message.slice(0,500),exhausted?null:retryAt(claimed.attempts),new Date().toISOString(),claimed.id).run();
    }
  }

  return {configured:true,pending:Number(pending?.n||0),processed,sent,failed};
}

export async function attemptImmediateEcommerceLifecycleEvents(ownerId:string){
  try{
    return await processDueEcommerceLifecycleEvents({ownerId,limit:10});
  }catch(error){
    console.error('Ecommerce lifecycle event processing failed after committed CRM change',error);
    return {configured:false,pending:0,processed:0,sent:0,failed:0};
  }
}
