import { database } from './raw.ts';
import { ensureCustomerRecordApiReady } from './customer-records.ts';
import { CUSTOMER_ORDER_DOMAIN } from './customer-order-shadow.ts';
import { validateWorkspaceChange } from '../lib/role-data.ts';
import { accountIds, applyDeliveryFollowUps, batchRemaining, collectedAmount, nextStatuses, orderBalance, receivable, today, uid, type Order, type State } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';

type Actor={userId:string;name:string;role:WorkspaceRole};
type OrderVersionRow={record_version:number};

async function ensureAuditTable(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

function orderReplaceStatements(ownerId:string,order:Order,expectedVersion:number,nextVersion:number,now:string){
  const db=database(),statements:any[]=[];
  statements.push(db.prepare('UPDATE crm_rel_orders SET number=?,customer_id=?,created=?,delivered=?,returned_at=?,settled_at=?,channel=?,payment=?,status=?,discount=?,delivery_charge=?,courier_cost=?,packaging=?,payment_fee=?,return_fee=?,settled=?,restocked=?,tracking=?,notes=?,record_version=record_version+1,updated_at=? WHERE owner_id=? AND id=? AND record_version=?')
    .bind(order.number,order.customerId,order.created,order.delivered||null,order.returnedAt||null,order.settledAt||null,order.channel,order.payment,order.status,order.discount,order.deliveryCharge,order.courierCost,order.packaging,order.paymentFee,order.returnFee,order.settled,order.restocked,order.tracking,order.notes,now,ownerId,order.id,expectedVersion));
  statements.push(db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_rel_orders WHERE owner_id=? AND id=? AND record_version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,order.id,nextVersion,now));
  statements.push(db.prepare('DELETE FROM crm_rel_order_allocations WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
  statements.push(db.prepare('DELETE FROM crm_rel_order_collections WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
  statements.push(db.prepare('DELETE FROM crm_rel_order_items WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
  order.items.forEach((item,lineNo)=>{
    statements.push(db.prepare('INSERT INTO crm_rel_order_items (owner_id,order_id,line_no,product_id,qty,price) VALUES (?,?,?,?,?,?)').bind(ownerId,order.id,lineNo,item.productId,item.qty,item.price));
    item.allocations.forEach((a,allocationNo)=>statements.push(db.prepare('INSERT INTO crm_rel_order_allocations (owner_id,order_id,line_no,allocation_no,batch_id,qty,unit_cost) VALUES (?,?,?,?,?,?,?)').bind(ownerId,order.id,lineNo,allocationNo,a.batchId,a.qty,a.unitCost)));
  });
  order.collections.forEach(c=>statements.push(db.prepare('INSERT INTO crm_rel_order_collections (owner_id,order_id,id,date,amount,reference) VALUES (?,?,?,?,?,?)').bind(ownerId,order.id,c.id,c.date,c.amount,c.reference)));
  return statements;
}

async function currentRecordVersion(ownerId:string,id:string){
  return database().prepare('SELECT record_version FROM crm_rel_orders WHERE owner_id=? AND id=?').bind(ownerId,id).first<OrderVersionRow>();
}

async function commitWorkflow(ownerId:string,before:State,next:State,rowVersion:number,changed:{order:Order;expectedVersion:number}[],actor:Actor,summary:string,sections:string[]){
  validateWorkspaceChange(before,next);
  const now=new Date().toISOString(),db=database(),nextWorkspaceVersion=rowVersion+1;
  await ensureAuditTable();
  const statements:any[]=[];
  for(const change of changed)statements.push(...orderReplaceStatements(ownerId,change.order,change.expectedVersion,change.expectedVersion+1,now));
  statements.push(db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(next),now,ownerId,rowVersion));
  statements.push(db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,nextWorkspaceVersion,now));
  statements.push(db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN));
  statements.push(db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,summary,JSON.stringify(sections),now));
  await db.batch(statements);
  return {workspaceVersion:nextWorkspaceVersion,recordVersions:Object.fromEntries(changed.map(c=>[c.order.id,c.expectedVersion+1]))};
}

export async function postOrderCollection(ownerId:string,input:{orderId:string;recordVersion:number;date:string;amount:number;reference:string;account:string},actor:Actor){
  if(!['owner','admin'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
  if(!accountIds.includes(input.account as any))throw new Error('Choose a valid account.');
  if(!Number.isInteger(input.recordVersion)||input.recordVersion<0)throw new Error('A valid order record version is required.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.date>today())throw new Error('Choose a valid payment date that is not in the future.');
  if(!Number.isFinite(input.amount)||input.amount<=0)throw new Error('Collection amount must be above zero.');
  const {row,state}=await ensureCustomerRecordApiReady(ownerId),order=state.orders.find(o=>o.id===input.orderId);
  if(!order)throw new Error('Order not found.');
  const version=await currentRecordVersion(ownerId,order.id);
  if(!version||Number(version.record_version)!==input.recordVersion)throw new Error('ORDER_VERSION_CONFLICT');
  const collectible=order.status==='Delivered'||(order.payment!=='COD'&&!['Cancelled','Returned'].includes(order.status));
  if(!collectible)throw new Error('This order is not ready for collection.');
  const balance=orderBalance(order);
  if(input.amount>balance+.001)throw new Error('Collection cannot exceed the outstanding order balance.');
  const opening=state.accountOpenings.find(a=>a.account===input.account);
  if(!opening)throw new Error('Configure this account opening balance before posting collections.');
  if(input.date<opening.date)throw new Error('Payment date cannot be before the account opening date.');
  const next=structuredClone(state),target=next.orders.find(o=>o.id===order.id)!,collectionId=uid();
  target.collections.push({id:collectionId,date:input.date,amount:input.amount,reference:input.reference.trim()});
  const due=receivable(target),received=collectedAmount(target);
  target.settled=received>=due-.001;target.settledAt=target.settled?input.date:undefined;
  next.accountMatches.push({entryId:'order-collection-'+target.id+'-'+collectionId,account:input.account as typeof accountIds[number],matched:true,reference:input.reference.trim()||'Customer collection'});
  const result=await commitWorkflow(ownerId,state,next,row.version,[{order:target,expectedVersion:input.recordVersion}],actor,'Recorded customer collection for '+target.number,['orders','accountMatches']);
  return {...result,order:target,collectionId};
}

export async function inspectReturnedOrderWorkflow(ownerId:string,input:{orderId:string;recordVersion:number;outcome:'Sellable'|'Quarantine'|'Damaged'},actor:Actor){
  if(!['owner','admin','inventory'].includes(actor.role))throw new Error('RETURN_INSPECTION_FORBIDDEN');
  if(!Number.isInteger(input.recordVersion)||input.recordVersion<0)throw new Error('A valid order record version is required.');
  const {row,state}=await ensureCustomerRecordApiReady(ownerId),order=state.orders.find(o=>o.id===input.orderId);
  if(!order)throw new Error('Order not found.');
  const version=await currentRecordVersion(ownerId,order.id);
  if(!version||Number(version.record_version)!==input.recordVersion)throw new Error('ORDER_VERSION_CONFLICT');
  if(order.status!=='Returned'||order.restocked)throw new Error('This return has already been inspected or is not ready for inspection.');
  const next=structuredClone(state),target=next.orders.find(o=>o.id===order.id)!;target.restocked=true;
  if(input.outcome!=='Sellable'){
    const byBatch=new Map<string,number>();
    for(const allocation of target.items.flatMap(i=>i.allocations))byBatch.set(allocation.batchId,(byBatch.get(allocation.batchId)||0)+allocation.qty);
    for(const [batchId,qty] of byBatch){
      const batch=next.batches.find(b=>b.id===batchId);
      if(!batch||batch.expiry<=today())continue;
      if(batchRemaining(next,batch)<qty)throw new Error('Returned stock cannot be held safely because the batch no longer has enough available units.');
      next.inventoryHolds.push({id:uid(),batchId,qty,date:today(),type:input.outcome,reason:input.outcome==='Damaged'?'Returned stock inspected as damaged':'Returned stock needs further inspection',source:'Return',sourceOrderId:target.id});
    }
  }
  const result=await commitWorkflow(ownerId,state,next,row.version,[{order:target,expectedVersion:input.recordVersion}],actor,'Inspected returned order '+target.number,['orders','inventoryHolds']);
  return {...result,order:target};
}

export async function bulkAdvanceOrdersWorkflow(ownerId:string,input:{orders:{id:string;recordVersion:number}[]},actor:Actor){
  if(!['owner','admin','sales'].includes(actor.role))throw new Error('ORDER_EDIT_FORBIDDEN');
  if(!Array.isArray(input.orders)||!input.orders.length||input.orders.length>100)throw new Error('Select between 1 and 100 orders.');
  const unique=[...new Map(input.orders.map(x=>[x.id,x])).values()];
  const {row,state}=await ensureCustomerRecordApiReady(ownerId),next=structuredClone(state);
  const changed:{order:Order;expectedVersion:number}[]=[],results:{id:string;ok:boolean;status?:Order['status'];error?:string}[]=[];
  for(const requested of unique){
    const before=state.orders.find(o=>o.id===requested.id),target=next.orders.find(o=>o.id===requested.id);
    if(!before||!target){results.push({id:requested.id,ok:false,error:'Order not found.'});continue}
    const version=await currentRecordVersion(ownerId,requested.id);
    if(!version||Number(version.record_version)!==requested.recordVersion){results.push({id:requested.id,ok:false,error:'Order changed in another window.'});continue}
    const status=nextStatuses(before).find(s=>!['Cancelled','Returned'].includes(s));
    if(!status){results.push({id:requested.id,ok:false,error:'No safe next fulfillment step.'});continue}
    target.status=status;if(status==='Delivered')target.delivered=today();
    changed.push({order:target,expectedVersion:requested.recordVersion});results.push({id:requested.id,ok:true,status});
  }
  if(!changed.length)return {workspaceVersion:row.version,recordVersions:{},results};
  const automated=applyDeliveryFollowUps(state,next);
  const byId=new Map(automated.orders.map(o=>[o.id,o]));
  const finalChanged=changed.map(c=>({order:byId.get(c.order.id)!,expectedVersion:c.expectedVersion}));
  const commit=await commitWorkflow(ownerId,state,automated,row.version,finalChanged,actor,'Advanced '+changed.length+' orders in bulk',['orders',...(automated.tasks.length!==state.tasks.length?['tasks']:[])]);
  return {...commit,results};
}
