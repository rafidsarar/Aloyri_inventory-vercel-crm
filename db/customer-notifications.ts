import { database } from './raw.ts';
import {
  fixedBusinessName,
  stateSchema,
  subtotal,
  total,
  type Order,
  type State
} from '../lib/crm.ts';

type NotificationRow={
  id:string;
  owner_id:string;
  order_id:string;
  event_key:string;
  order_status:string;
  channel:string;
  recipient:string;
  state:string;
  attempts:number;
  next_attempt_at:string|null;
  created_at:string;
};

const MAX_ATTEMPTS=5;

function eventSlug(value:string){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export function notificationEventKey(status:Order['status']){
  return 'status:'+eventSlug(status);
}

export function notificationContactStatements(
  ownerId:string,
  orderId:string,
  email:string,
  phone:string,
  now:string
){
  const db=database();
  return [
    db.prepare(
      'INSERT INTO crm_ecommerce_order_contacts (owner_id,order_id,email,phone,created_at,updated_at) VALUES (?,?,?,?,?,?) '+
      'ON CONFLICT(owner_id,order_id) DO UPDATE SET email=excluded.email,phone=excluded.phone,updated_at=excluded.updated_at'
    ).bind(ownerId,orderId,email.trim().toLowerCase(),phone.trim(),now,now)
  ];
}

function eventInsertStatement(input:{
  ownerId:string;
  orderId:string;
  eventKey:string;
  status:string;
  now:string;
  recipient?:string;
}){
  const db=database(),id=crypto.randomUUID();
  if(input.recipient!==undefined){
    const recipient=input.recipient.trim().toLowerCase();
    return db.prepare(
      'INSERT INTO crm_customer_notification_outbox '+
      '(id,owner_id,order_id,event_key,order_status,channel,recipient,state,attempts,next_attempt_at,last_error,provider_id,created_at,updated_at,sent_at) '+
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,order_id,event_key,channel) DO NOTHING'
    ).bind(
      id,input.ownerId,input.orderId,input.eventKey,input.status,'email',recipient,
      recipient?'queued':'skipped',0,recipient?input.now:null,
      recipient?'':'Customer did not provide an email address.','',
      input.now,input.now,null
    );
  }

  return db.prepare(
    'INSERT INTO crm_customer_notification_outbox '+
    '(id,owner_id,order_id,event_key,order_status,channel,recipient,state,attempts,next_attempt_at,last_error,provider_id,created_at,updated_at,sent_at) '+
    "SELECT ?,?,?,?,?, 'email',COALESCE(c.email,''),CASE WHEN COALESCE(c.email,'')='' THEN 'skipped' ELSE 'queued' END,0,"+
    "CASE WHEN COALESCE(c.email,'')='' THEN NULL ELSE ? END,"+
    "CASE WHEN COALESCE(c.email,'')='' THEN 'Customer did not provide an email address.' ELSE '' END,'',?,?,NULL "+
    'FROM (SELECT 1) seed LEFT JOIN crm_ecommerce_order_contacts c ON c.owner_id=? AND c.order_id=? '+
    'ON CONFLICT(owner_id,order_id,event_key,channel) DO NOTHING'
  ).bind(
    id,input.ownerId,input.orderId,input.eventKey,input.status,
    input.now,input.now,input.now,input.ownerId,input.orderId
  );
}

export function initialWebsiteNotificationStatements(input:{
  ownerId:string;
  order:Order;
  email:string;
  phone:string;
  now:string;
}){
  return [
    ...notificationContactStatements(
      input.ownerId,
      input.order.id,
      input.email,
      input.phone,
      input.now
    ),
    eventInsertStatement({
      ownerId:input.ownerId,
      orderId:input.order.id,
      eventKey:'order.created',
      status:input.order.status,
      now:input.now,
      recipient:input.email
    })
  ];
}

export function notificationStatusChangeStatements(
  ownerId:string,
  before:Order,
  after:Order,
  now:string
){
  if(
    before.channel!=='Website' ||
    after.channel!=='Website' ||
    before.status===after.status
  )return [];

  return [
    eventInsertStatement({
      ownerId,
      orderId:after.id,
      eventKey:notificationEventKey(after.status),
      status:after.status,
      now
    })
  ];
}

function money(value:number){
  return new Intl.NumberFormat('en-BD',{
    style:'currency',
    currency:'BDT',
    maximumFractionDigits:0
  }).format(value);
}

function escapeHtml(value:string){
  return value
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function statusCopy(status:string,eventKey:string){
  if(eventKey==='order.created')return {
    subject:'We received your Aloyri order',
    heading:'Order received',
    message:'Your order has been received and is now in the Aloyri fulfillment queue.'
  };
  const byStatus:Record<string,{subject:string;heading:string;message:string}>={
    'Confirmed':{
      subject:'Your Aloyri order is confirmed',
      heading:'Order confirmed',
      message:'Your order has been confirmed and is moving to fulfillment.'
    },
    'Ready to pack':{
      subject:'Your Aloyri order is being prepared',
      heading:'Preparing your order',
      message:'Your order is ready for packing.'
    },
    'Packed':{
      subject:'Your Aloyri order is packed',
      heading:'Packed and ready',
      message:'Your parcel has been packed and is ready for the next delivery step.'
    },
    'Shipped':{
      subject:'Your Aloyri order has shipped',
      heading:'Your order is on the way',
      message:'Your parcel has left Aloyri and is with the delivery process.'
    },
    'Out for delivery':{
      subject:'Your Aloyri order is out for delivery',
      heading:'Out for delivery',
      message:'Your parcel is on its way to the delivery address.'
    },
    'Delivered':{
      subject:'Your Aloyri order was delivered',
      heading:'Delivered',
      message:'Your Aloyri order has been marked as delivered.'
    },
    'Cancelled':{
      subject:'Your Aloyri order was cancelled',
      heading:'Order cancelled',
      message:'This order has been cancelled in Aloyri.'
    },
    'Returned':{
      subject:'Your Aloyri return was recorded',
      heading:'Return recorded',
      message:'A return has been recorded for this order.'
    }
  };
  return byStatus[status]||{
    subject:'Your Aloyri order status changed',
    heading:'Order update',
    message:'There is a new update for your Aloyri order.'
  };
}

export function buildCustomerNotification(
  state:State,
  order:Order,
  status:string,
  eventKey:string
){
  const copy=statusCopy(status,eventKey);
  const productsSubtotal=Math.round((subtotal(order)+order.discount)*100)/100;
  const orderTotal=Math.round(total(order)*100)/100;
  const storefront=(process.env.PUBLIC_STOREFRONT_URL||'https://aloyri-ecommerce.vercel.app').replace(/\/$/,'');
  const trackingUrl=storefront+'/track-order?order='+encodeURIComponent(order.number);
  const lines=order.items.map(item=>{
    const product=state.products.find(p=>p.id===item.productId);
    return {
      name:product?.name||'Skincare product',
      brand:product?.brand||'',
      qty:item.qty,
      unitPrice:item.price
    };
  });

  const subject=copy.subject+' · '+order.number;
  const text=[
    copy.heading,
    '',
    copy.message,
    '',
    'Order: '+order.number,
    'Status: '+status,
    ...lines.map(item=>'• '+[item.brand,item.name].filter(Boolean).join(' ')+' × '+item.qty+' — '+money(item.unitPrice*item.qty)),
    '',
    'Products: '+money(productsSubtotal),
    ...(order.discount>0?['Discount: -'+money(order.discount)]:[]),
    'Delivery: '+money(order.deliveryCharge),
    'Total: '+money(orderTotal),
    'Payment: '+(order.payment==='COD'?'Cash on Delivery':order.payment),
    ...(order.tracking.trim()?['Courier reference: '+order.tracking.trim()]:[]),
    '',
    'Track your order: '+trackingUrl,
    '',
    'Aloyri — Let Your Skin Glow.'
  ].join('\n');

  const itemHtml=lines.map(item=>
    '<tr><td style="padding:8px 0;color:#321f1c">'+
    escapeHtml([item.brand,item.name].filter(Boolean).join(' '))+
    ' × '+item.qty+
    '</td><td style="padding:8px 0;text-align:right;color:#321f1c">'+
    escapeHtml(money(item.unitPrice*item.qty))+
    '</td></tr>'
  ).join('');

  const html='<!doctype html><html><body style="margin:0;background:#fffaf7;font-family:Arial,sans-serif;color:#321f1c">'+
    '<div style="max-width:620px;margin:0 auto;padding:36px 20px">'+
    '<div style="font-size:13px;letter-spacing:3px;color:#713a35;font-weight:700">ALOYRI</div>'+
    '<h1 style="font-family:Georgia,serif;font-size:34px;font-weight:500;margin:18px 0 10px">'+escapeHtml(copy.heading)+'</h1>'+
    '<p style="line-height:1.7;color:#6f5a55">'+escapeHtml(copy.message)+'</p>'+
    '<div style="margin:24px 0;padding:18px;border-radius:16px;background:#f7ebe6">'+
    '<div style="font-size:12px;color:#796762">Order</div>'+
    '<div style="font-size:17px;font-weight:700;margin-top:4px">'+escapeHtml(order.number)+'</div>'+
    '<div style="font-size:13px;color:#713a35;margin-top:8px">'+escapeHtml(status)+'</div></div>'+
    '<table style="width:100%;border-collapse:collapse">'+itemHtml+'</table>'+
    '<div style="border-top:1px solid #ead7ce;margin-top:16px;padding-top:16px">'+
    '<p style="margin:5px 0;color:#6f5a55">Products <strong style="float:right;color:#321f1c">'+escapeHtml(money(productsSubtotal))+'</strong></p>'+
    (order.discount>0?'<p style="margin:5px 0;color:#6f5a55">Discount <strong style="float:right;color:#321f1c">-'+escapeHtml(money(order.discount))+'</strong></p>':'')+
    '<p style="margin:5px 0;color:#6f5a55">Delivery <strong style="float:right;color:#321f1c">'+escapeHtml(money(order.deliveryCharge))+'</strong></p>'+
    '<p style="margin:14px 0 5px;font-size:18px">Total <strong style="float:right">'+escapeHtml(money(orderTotal))+'</strong></p></div>'+
    (order.tracking.trim()?'<p style="margin-top:18px;color:#6f5a55">Courier reference: <strong>'+escapeHtml(order.tracking.trim())+'</strong></p>':'')+
    '<p style="margin:28px 0"><a href="'+escapeHtml(trackingUrl)+'" style="display:inline-block;background:#713a35;color:white;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:700">Track your order</a></p>'+
    '<p style="font-size:12px;line-height:1.7;color:#9a817b">This is a transactional update about an order placed with Aloyri.</p>'+
    '</div></body></html>';

  return {subject,text,html,trackingUrl};
}

async function workspaceState(ownerId:string){
  const row=await database().prepare('SELECT data FROM crm_workspaces WHERE owner_id=?')
    .bind(ownerId).first<{data:string}>();
  if(!row)return null;
  return fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
}

async function sendResendEmail(input:{
  id:string;
  recipient:string;
  subject:string;
  text:string;
  html:string;
}){
  const apiKey=(process.env.RESEND_API_KEY||'').trim();
  const from=(process.env.CUSTOMER_NOTIFICATION_FROM||'').trim();
  const replyTo=(process.env.CUSTOMER_NOTIFICATION_REPLY_TO||'').trim();
  if(!apiKey||!from)throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');

  const payload:Record<string,unknown>={
    from,
    to:[input.recipient],
    subject:input.subject,
    text:input.text,
    html:input.html
  };
  if(replyTo)payload.reply_to=[replyTo];

  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+apiKey,
      'Content-Type':'application/json',
      'Idempotency-Key':'aloyri-notification-'+input.id
    },
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(10000)
  });

  const body=await response.text();
  if(!response.ok)throw new Error('RESEND_'+response.status+':'+body.slice(0,300));
  let providerId='';
  try{
    const parsed=JSON.parse(body) as {id?:unknown};
    providerId=typeof parsed.id==='string'?parsed.id:'';
  }catch{}
  return providerId;
}

function retryAt(attempt:number){
  const minutes=[1,5,15,60,240][Math.max(0,Math.min(4,attempt-1))];
  return new Date(Date.now()+minutes*60_000).toISOString();
}

export async function processDueCustomerNotifications(input:{ownerId?:string;limit?:number}={}){
  const db=database(),now=new Date().toISOString(),limit=Math.max(1,Math.min(50,input.limit||20));
  const providerConfigured=Boolean(
    (process.env.RESEND_API_KEY||'').trim() &&
    (process.env.CUSTOMER_NOTIFICATION_FROM||'').trim()
  );

  const ownerClause=input.ownerId?' AND owner_id=?':'';
  const count=await db.prepare(
    "SELECT COUNT(*) AS n FROM crm_customer_notification_outbox WHERE state IN ('queued','failed') AND next_attempt_at IS NOT NULL AND next_attempt_at<=?"+ownerClause
  ).bind(now,...(input.ownerId?[input.ownerId]:[])).first<{n:number|string}>();

  if(!providerConfigured){
    return {configured:false,pending:Number(count?.n||0),processed:0,sent:0,failed:0};
  }

  await db.prepare(
    "UPDATE crm_customer_notification_outbox SET state='failed',next_attempt_at=?,last_error='Recovered interrupted send.',updated_at=? "+
    "WHERE state='sending' AND updated_at<?"
  ).bind(now,now,new Date(Date.now()-10*60_000).toISOString()).run();

  const due=await db.prepare(
    "SELECT id,owner_id,order_id,event_key,order_status,channel,recipient,state,attempts,next_attempt_at,created_at "+
    "FROM crm_customer_notification_outbox WHERE state IN ('queued','failed') AND channel='email' AND recipient<>'' "+
    "AND next_attempt_at IS NOT NULL AND next_attempt_at<=?"+ownerClause+
    ' ORDER BY created_at ASC LIMIT ?'
  ).bind(now,...(input.ownerId?[input.ownerId]:[]),limit).all<NotificationRow>();

  let sent=0,failed=0,processed=0;
  const stateCache=new Map<string,State|null>();

  for(const candidate of due.results){
    const claimed=await db.prepare(
      "UPDATE crm_customer_notification_outbox SET state='sending',attempts=attempts+1,updated_at=? "+
      "WHERE id=? AND state IN ('queued','failed') AND next_attempt_at IS NOT NULL AND next_attempt_at<=? "+
      "RETURNING id,owner_id,order_id,event_key,order_status,channel,recipient,state,attempts,next_attempt_at,created_at"
    ).bind(new Date().toISOString(),candidate.id,new Date().toISOString()).first<NotificationRow>();
    if(!claimed)continue;
    processed++;

    try{
      let state=stateCache.get(claimed.owner_id);
      if(state===undefined){
        state=await workspaceState(claimed.owner_id);
        stateCache.set(claimed.owner_id,state);
      }
      const order=state?.orders.find(item=>item.id===claimed.order_id);
      if(!state||!order||order.channel!=='Website'){
        await db.prepare(
          "UPDATE crm_customer_notification_outbox SET state='skipped',last_error=?,next_attempt_at=NULL,updated_at=? WHERE id=?"
        ).bind('Website order is no longer available.',new Date().toISOString(),claimed.id).run();
        continue;
      }

      const content=buildCustomerNotification(state,order,claimed.order_status,claimed.event_key);
      const providerId=await sendResendEmail({
        id:claimed.id,
        recipient:claimed.recipient,
        subject:content.subject,
        text:content.text,
        html:content.html
      });
      const finished=new Date().toISOString();
      await db.prepare(
        "UPDATE crm_customer_notification_outbox SET state='sent',provider_id=?,last_error='',next_attempt_at=NULL,sent_at=?,updated_at=? WHERE id=?"
      ).bind(providerId,finished,finished,claimed.id).run();
      sent++;
    }catch(error){
      failed++;
      const message=error instanceof Error?error.message:'Notification delivery failed.';
      const exhausted=claimed.attempts>=MAX_ATTEMPTS;
      const updated=new Date().toISOString();
      await db.prepare(
        "UPDATE crm_customer_notification_outbox SET state='failed',last_error=?,next_attempt_at=?,updated_at=? WHERE id=?"
      ).bind(message.slice(0,500),exhausted?null:retryAt(claimed.attempts),updated,claimed.id).run();
    }
  }

  return {configured:true,pending:Number(count?.n||0),processed,sent,failed};
}

export async function attemptImmediateCustomerNotifications(ownerId:string){
  try{
    return await processDueCustomerNotifications({ownerId,limit:10});
  }catch(error){
    console.error('Customer notification processing failed after committed CRM change',error);
    return {configured:false,pending:0,processed:0,sent:0,failed:0};
  }
}
