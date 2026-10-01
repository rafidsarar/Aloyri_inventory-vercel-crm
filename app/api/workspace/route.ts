import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { visibleState, applyRoleChanges, validateWorkspaceChange } from '@/lib/role-data';
import { canManageBusinessSettings } from '@/lib/roles';
import { database } from '@/db/raw';
import { initialState, stateSchema, fixedBusinessName, validateRelations, nextStatuses, applyCancellationQuarantine, applyDeliveryFollowUps, type State } from '@/lib/crm';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

function validateTransitions(previous:State,next:State){
  const oldOrders=new Map(previous.orders.map(o=>[o.id,o]));
  for(const order of next.orders){const before=oldOrders.get(order.id);if(before&&before.status!==order.status&&!nextStatuses(before).includes(order.status))throw new Error('Invalid order status transition for #'+before.number+'.');}
  const allowed:Record<State['purchaseOrders'][number]['status'],readonly State['purchaseOrders'][number]['status'][]>={
    Draft:['Draft','Sent','Cancelled'],Sent:['Sent','Part received','Received','Cancelled'],'Part received':['Part received','Received','Cancelled'],Received:['Received'],Cancelled:['Cancelled']
  };
  const oldPOs=new Map(previous.purchaseOrders.map(p=>[p.id,p]));
  for(const po of next.purchaseOrders){const before=oldPOs.get(po.id);if(!before)continue;if(!allowed[before.status].includes(po.status))throw new Error('Invalid purchase order status transition for '+before.number+'.');for(const item of po.items){const oldItem=before.items.find(x=>x.productId===item.productId);if(oldItem&&item.receivedQty<oldItem.receivedQty)throw new Error('Received purchase-order quantities cannot be reduced.');}}
  for(const before of previous.purchaseOrders)if(!next.purchaseOrders.some(p=>p.id===before.id)&&before.items.some(i=>i.receivedQty>0))throw new Error('A purchase order with received stock cannot be deleted.');
}

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to open the workspace.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    const db=database();
    if(role==='owner')await db.prepare('INSERT OR IGNORE INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,0,?)').bind(ownerId,JSON.stringify(initialState()),new Date().toISOString()).run();
    const row=await db.prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
    if(!row)return response({error:'The shared workspace is not ready. Ask the owner to sign in first.'},404);
    const workspace=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));validateRelations(workspace,{skipOrderNumberUniqueness:true});
    return response({data:visibleState(workspace,role),version:row.version,role,userName:user.displayName});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace read failed',e);
    return response({error:'Could not load your records. Please try again.'},503);
  }
}

export async function PUT(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in before saving.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(role==='viewer')return response({error:'Your access is view-only. Ask the owner for staff access to make changes.'},403);
    const text=await request.text();
    if(text.length>1800000)return response({error:'Workspace is too large. Export a backup and contact support.'},413);
    let body;
    try{body=JSON.parse(text)}catch{return response({error:'Invalid request.'},400)}
    const parsed=stateSchema.safeParse(body.data);
    if(!parsed.success||!Number.isInteger(body.version)||body.version<0)return response({error:'Check the values in your form.'},400);
    const db=database();
    const existing=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number}>();
    if(!existing||existing.version!==body.version)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);
    const previous=fixedBusinessName(stateSchema.parse(JSON.parse(existing.data)));
    if(!canManageBusinessSettings(role)&&(['businessName','businessProfile'] as const).some(key=>JSON.stringify(parsed.data[key])!==JSON.stringify(visibleState(previous,role)[key])))
      return response({error:'Only the owner or an admin can edit Business settings.'},403);
    let merged:typeof previous;
    try{merged=applyRoleChanges(previous,parsed.data,role)}catch(e){return response({error:e instanceof Error?e.message:'You cannot change that section.'},403)}
    merged=applyDeliveryFollowUps(previous,applyCancellationQuarantine(previous,fixedBusinessName(merged)));
    try{validateTransitions(previous,merged);validateWorkspaceChange(previous,merged)}catch(e){return response({error:e instanceof Error?e.message:'Invalid records.'},400)}
    const changedSections=(Object.keys(previous) as (keyof typeof previous)[]).filter(key=>JSON.stringify(previous[key])!==JSON.stringify(merged[key])).map(String);
    const now=new Date().toISOString();
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
    const result=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(merged),now,ownerId,body.version).run();
    if(!result.meta.changes)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);
    if(changedSections.length)await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,user.userId,user.displayName||user.email,role,'Updated '+changedSections.join(', '),JSON.stringify(changedSections),now).run();
    return response({version:body.version+1,data:visibleState(merged,role)});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace save failed',e);
    return response({error:'Your changes could not be saved. Please try again.'},503);
  }
}
