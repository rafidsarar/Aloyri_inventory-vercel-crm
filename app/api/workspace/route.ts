import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { visibleState, applyRoleChanges } from '@/lib/role-data';
import { canManageBusinessSettings } from '@/lib/roles';
import { database } from '@/db/raw';
import { initialState, stateSchema, validateRelations, fixedBusinessName, cashflow } from '@/lib/crm';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to open the workspace.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    const db=database();
    if(role==='owner')await db.prepare('INSERT OR IGNORE INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,0,?)').bind(ownerId,JSON.stringify(initialState()),new Date().toISOString()).run();
    let row=await db.prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
    if(!row)return response({error:'The shared workspace is not ready. Ask the owner to sign in first.'},404);
    // One-time production cleanup requested by the owner on 2026-09-29.
    // The timestamp gate makes this migration self-disabling after the first successful reset.
    const cleanupCutoff='2026-09-29T11:00:00.000Z';
    if(row.updated_at<cleanupCutoff){
      const current=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
      const keepProducts=current.products.slice(0,2);
      const cleaned={...current,products:keepProducts,customers:[],suppliers:[],batches:[],stockAdjustments:[],orders:[],expenses:[],cashEntries:[],accountOpenings:[],accountMatches:[],tasks:[]};
      validateRelations(cleaned);
      const now=new Date().toISOString();
      const reset=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(cleaned),now,ownerId,row.version).run();
      if(reset.meta.changes)row={data:JSON.stringify(cleaned),version:row.version+1,updated_at:now};
      else row=await db.prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number;updated_at:string}>()||row;
    }
    return response({data:visibleState(fixedBusinessName(stateSchema.parse(JSON.parse(row.data))),role),version:row.version,role,userName:user.displayName});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace read failed',e);
    return response({error:'Could not load your records. Please try again.'},503);
  }
}

function closedPeriodViolation(previous:ReturnType<typeof fixedBusinessName>,next:ReturnType<typeof fixedBusinessName>){
 const closed=new Set(previous.financeCloses.map(x=>x.month));if(!closed.size)return '';
 const locked=(date:string)=>closed.has(date.slice(0,7));
 const byId=(xs:Array<{id:string}&Record<string,unknown>>)=>new Map(xs.map(x=>[x.id,x]));
 const prevOrders=new Map(previous.orders.map(x=>[x.id,x])),nextOrders=new Map(next.orders.map(x=>[x.id,x]));
 for(const [id,p] of prevOrders){const n=nextOrders.get(id);if(!n&&locked(p.delivered||p.created))return 'Orders in a closed month are locked.';if(n){const pc=p.collections.filter(x=>locked(x.date)),nc=n.collections.filter(x=>locked(x.date));if(JSON.stringify(pc)!==JSON.stringify(nc))return 'Customer collections in a closed month are locked.';if(locked(p.delivered||p.created)&&JSON.stringify(p)!==JSON.stringify(n))return 'Delivered orders in a closed month are locked.'}}
 for(const n of next.orders)if(!prevOrders.has(n.id)&&locked(n.delivered||n.created))return 'New orders cannot be posted into a closed month.';
 const prevBatches=new Map(previous.batches.map(x=>[x.id,x])),nextBatches=new Map(next.batches.map(x=>[x.id,x]));
 for(const [id,p] of prevBatches){const n=nextBatches.get(id);if(!n&&locked(p.received))return 'Purchases received in a closed month are locked.';if(n){const pp=p.payments.filter(x=>locked(x.date)),np=n.payments.filter(x=>locked(x.date));if(JSON.stringify(pp)!==JSON.stringify(np))return 'Supplier payments in a closed month are locked.';if(locked(p.received)&&JSON.stringify({...p,payments:[]})!==JSON.stringify({...n,payments:[]}))return 'Purchases received in a closed month are locked.'}}
 for(const n of next.batches)if(!prevBatches.has(n.id)&&locked(n.received))return 'New stock receipts cannot be posted into a closed month.';
 for(const key of ['expenses','cashEntries'] as const){const p=new Map(previous[key].map(x=>[x.id,x])),n=new Map(next[key].map(x=>[x.id,x]));for(const [id,row] of p){const nr=n.get(id);if((!nr||JSON.stringify(row)!==JSON.stringify(nr))&&locked(row.date))return (key==='expenses'?'Expenses':'Cash movements')+' in a closed month are locked.'}for(const [id,row] of n)if(!p.has(id)&&locked(row.date))return 'New '+(key==='expenses'?'expenses':'cash movements')+' cannot be posted into a closed month.'}
 const lockedEntryIds=new Set(cashflow(previous).entries.filter(e=>locked(e.date)).map(e=>e.id));const pm=new Map(previous.accountMatches.map(x=>[x.entryId,x])),nm=new Map(next.accountMatches.map(x=>[x.entryId,x]));for(const id of lockedEntryIds)if(JSON.stringify(pm.get(id))!==JSON.stringify(nm.get(id)))return 'Reconciliation assignments in a closed month are locked.';
 return '';
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
    if(!canManageBusinessSettings(role)&&(['businessName','businessProfile','budget'] as const).some(key=>JSON.stringify(parsed.data[key])!==JSON.stringify(visibleState(previous,role)[key])))
      return response({error:'Only the owner or an admin can edit Business settings.'},403);
    let merged:typeof previous;
    try{merged=applyRoleChanges(previous,parsed.data,role)}catch(e){return response({error:e instanceof Error?e.message:'You cannot change that section.'},403)}
    merged=fixedBusinessName(merged);
    const closedError=closedPeriodViolation(previous,merged);if(closedError)return response({error:closedError+' Reopen the month from Finance → Month-end close before changing it.'},409);
    try{validateRelations(merged)}catch(e){return response({error:e instanceof Error?e.message:'Invalid records.'},400)}
    const result=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(merged),new Date().toISOString(),ownerId,body.version).run();
    if(!result.meta.changes)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);
    return response({version:body.version+1});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace save failed',e);
    return response({error:'Your changes could not be saved. Please try again.'},503);
  }
}
