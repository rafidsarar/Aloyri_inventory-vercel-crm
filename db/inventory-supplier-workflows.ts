import { database } from './raw.ts';
import { applyPurchaseOrderReceipt, accountIds, fixedBusinessName, stateSchema, today, uid, validateRelations, type State } from '../lib/crm.ts';
import { validateWorkspaceChange } from '../lib/role-data.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureInventorySupplierApiReady, migrateInventorySupplierShadow } from './inventory-supplier-shadow.ts';

type Actor={userId:string;name:string;role:WorkspaceRole};

async function ensureAudit(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

async function commit(ownerId:string,before:State,next:State,version:number,actor:Actor,summary:string,sections:string[]){
  validateWorkspaceChange(before,next);validateRelations(next,{skipOrderNumberUniqueness:true});
  const db=database(),now=new Date().toISOString(),nextVersion=version+1;
  await ensureAudit();
  const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
    .bind(JSON.stringify(fixedBusinessName(next)),now,ownerId,version).run();
  if(!result.meta.changes)throw new Error('WORKSPACE_VERSION_CONFLICT');
  await migrateInventorySupplierShadow(ownerId,next,nextVersion);
  await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,summary,JSON.stringify(sections),now).run();
  return {version:nextVersion};
}

export async function receivePurchaseOrderWorkflow(ownerId:string,input:{purchaseOrderId:string;received:string;invoice:string;dueDate?:string;lines:{productId:string;qty:number;expiry:string}[];version:number},actor:Actor){
  if(!['owner','admin','inventory'].includes(actor.role))throw new Error('PURCHASING_FORBIDDEN');
  const {row,state}=await ensureInventorySupplierApiReady(ownerId);
  if(row.version!==input.version)throw new Error('WORKSPACE_VERSION_CONFLICT');
  const next=applyPurchaseOrderReceipt(state,{purchaseOrderId:input.purchaseOrderId,received:input.received,invoice:input.invoice,dueDate:input.dueDate,lines:input.lines});
  const po=next.purchaseOrders.find(x=>x.id===input.purchaseOrderId);
  const result=await commit(ownerId,state,next,row.version,actor,'Received stock for '+(po?.number||'purchase order'),['purchaseOrders','batches']);
  return {...result,data:{purchaseOrders:next.purchaseOrders,batches:next.batches}};
}

export async function postSupplierPaymentWorkflow(ownerId:string,input:{batchId:string;date:string;amount:number;note:string;account:string;version:number},actor:Actor){
  if(!['owner','admin'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
  if(!accountIds.includes(input.account as any))throw new Error('Choose a valid account.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.date>today())throw new Error('Choose a valid payment date that is not in the future.');
  if(!Number.isFinite(input.amount)||input.amount<=0)throw new Error('Payment amount must be above zero.');
  const {row,state}=await ensureInventorySupplierApiReady(ownerId);
  if(row.version!==input.version)throw new Error('WORKSPACE_VERSION_CONFLICT');
  const batch=state.batches.find(x=>x.id===input.batchId);if(!batch)throw new Error('Inventory batch not found.');
  const opening=state.accountOpenings.find(a=>a.account===input.account);if(!opening)throw new Error('Configure this account opening balance before posting supplier payments.');
  if(input.date<opening.date)throw new Error('Payment date cannot be before the account opening date.');
  const total=batch.qty*batch.unitCost,legacy=batch.paid&&batch.payments.length===0?total:0,paid=legacy+batch.payments.reduce((n,p)=>n+p.amount,0),balance=Math.max(0,total-paid);
  if(input.amount>balance+.001)throw new Error('Supplier payment cannot exceed the outstanding purchase amount.');
  const next=structuredClone(state),target=next.batches.find(x=>x.id===input.batchId)!,paymentId=uid();
  target.payments.push({id:paymentId,date:input.date,amount:input.amount,note:input.note.trim()});
  const paidAfter=(target.paid&&target.payments.length===1?total:0)+target.payments.reduce((n,p)=>n+p.amount,0);
  target.paid=paidAfter>=total-.001;target.paidAt=target.paid?input.date:undefined;
  next.accountMatches.push({entryId:'batch-payment-'+target.id+'-'+paymentId,account:input.account as typeof accountIds[number],matched:true,reference:input.note.trim()||'Supplier payment'});
  const result=await commit(ownerId,state,next,row.version,actor,'Recorded supplier payment for '+(target.invoice||target.id),['batches','accountMatches']);
  return {...result,batch:target,paymentId};
}
