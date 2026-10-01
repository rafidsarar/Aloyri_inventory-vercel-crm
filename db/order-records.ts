import { database } from './raw.ts';
import { ensureCustomerRecordApiReady } from './customer-records.ts';
import { CUSTOMER_ORDER_DOMAIN } from './customer-order-shadow.ts';
import { applyRoleChanges, validateWorkspaceChange, visibleState } from '../lib/role-data.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { applyCancellationQuarantine, applyDeliveryFollowUps, nextStatuses, orderSchema, type Order, type State } from '../lib/crm.ts';

export type OrderRecord=Order&{recordVersion:number};
export type OrderActor={userId:string;name:string;role:WorkspaceRole};

type OrderRow={
  id:string;number:string;customer_id:string;created:string;delivered:string|null;returned_at:string|null;settled_at:string|null;
  channel:Order['channel'];payment:Order['payment'];status:Order['status'];discount:string|number;delivery_charge:string|number;
  courier_cost:string|number;packaging:string|number;payment_fee:string|number;return_fee:string|number;
  settled:boolean;restocked:boolean;tracking:string;notes:string;record_version:number;
};
type ItemRow={order_id:string;line_no:number;product_id:string;qty:number;price:string|number};
type AllocationRow={order_id:string;line_no:number;allocation_no:number;batch_id:string;qty:number;unit_cost:string|number};
type CollectionRow={order_id:string;id:string;date:string;amount:string|number;reference:string};

async function ensureAuditTable(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

function mapOrder(row:OrderRow,items:ItemRow[],allocations:AllocationRow[],collections:CollectionRow[]):OrderRecord{
  return {
    id:row.id,number:row.number,customerId:row.customer_id,created:row.created,
    delivered:row.delivered||undefined,returnedAt:row.returned_at||undefined,settledAt:row.settled_at||undefined,
    collections:collections.filter(c=>c.order_id===row.id).map(c=>({id:c.id,date:c.date,amount:Number(c.amount),reference:c.reference})),
    channel:row.channel,payment:row.payment,status:row.status,
    items:items.filter(i=>i.order_id===row.id).sort((a,b)=>a.line_no-b.line_no).map(i=>({
      productId:i.product_id,qty:Number(i.qty),price:Number(i.price),
      allocations:allocations.filter(a=>a.order_id===row.id&&a.line_no===i.line_no).sort((a,b)=>a.allocation_no-b.allocation_no).map(a=>({
        batchId:a.batch_id,qty:Number(a.qty),unitCost:Number(a.unit_cost)
      }))
    })),
    discount:Number(row.discount),deliveryCharge:Number(row.delivery_charge),courierCost:Number(row.courier_cost),
    packaging:Number(row.packaging),paymentFee:Number(row.payment_fee),returnFee:Number(row.return_fee),
    settled:Boolean(row.settled),restocked:Boolean(row.restocked),tracking:row.tracking,notes:row.notes,
    recordVersion:Number(row.record_version)
  };
}

async function readOrderRows(ownerId:string,id?:string){
  await ensureCustomerRecordApiReady(ownerId);
  const db=database();
  const where=id?'owner_id=? AND id=?':'owner_id=?';
  const binds=id?[ownerId,id]:[ownerId];
  const parents=await db.prepare('SELECT id,number,customer_id,created,delivered,returned_at,settled_at,channel,payment,status,discount,delivery_charge,courier_cost,packaging,payment_fee,return_fee,settled,restocked,tracking,notes,record_version FROM crm_rel_orders WHERE '+where+' ORDER BY created DESC,id').bind(...binds).all<OrderRow>();
  const orderIds=parents.results.map(r=>r.id);
  if(!orderIds.length)return [];
  const items=await db.prepare('SELECT order_id,line_no,product_id,qty,price FROM crm_rel_order_items WHERE owner_id=?'+(id?' AND order_id=?':'')+' ORDER BY order_id,line_no').bind(...binds).all<ItemRow>();
  const allocations=await db.prepare('SELECT order_id,line_no,allocation_no,batch_id,qty,unit_cost FROM crm_rel_order_allocations WHERE owner_id=?'+(id?' AND order_id=?':'')+' ORDER BY order_id,line_no,allocation_no').bind(...binds).all<AllocationRow>();
  const collections=await db.prepare('SELECT order_id,id,date,amount,reference FROM crm_rel_order_collections WHERE owner_id=?'+(id?' AND order_id=?':'')+' ORDER BY order_id,date,id').bind(...binds).all<CollectionRow>();
  return parents.results.map(row=>mapOrder(row,items.results,allocations.results,collections.results));
}

export const listOrderRecords=(ownerId:string)=>readOrderRows(ownerId);
export async function getOrderRecord(ownerId:string,id:string){return (await readOrderRows(ownerId,id))[0]||null}

function proposedWithOrder(state:State,order:Order,role:WorkspaceRole){
  const proposed=structuredClone(visibleState(state,role));
  const index=proposed.orders.findIndex(item=>item.id===order.id);
  if(index<0)proposed.orders.push(order);else proposed.orders[index]=order;
  return proposed;
}

function proposedWithoutOrder(state:State,id:string,role:WorkspaceRole){
  const proposed=structuredClone(visibleState(state,role));
  proposed.orders=proposed.orders.filter(order=>order.id!==id);
  return proposed;
}

function finalizeOrderChange(state:State,proposed:State,role:WorkspaceRole){
  let merged=applyRoleChanges(state,proposed,role);
  merged=applyDeliveryFollowUps(state,applyCancellationQuarantine(state,merged));
  validateWorkspaceChange(state,merged);
  return merged;
}

function orderStatements(ownerId:string,order:Order,recordVersion:number,now:string,replace:boolean){
  const db=database(),statements=[] as ReturnType<typeof db.prepare>[];
  if(replace){
    statements.push(db.prepare('DELETE FROM crm_rel_order_allocations WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
    statements.push(db.prepare('DELETE FROM crm_rel_order_collections WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
    statements.push(db.prepare('DELETE FROM crm_rel_order_items WHERE owner_id=? AND order_id=?').bind(ownerId,order.id));
  }
  order.items.forEach((item,lineNo)=>{
    statements.push(db.prepare('INSERT INTO crm_rel_order_items (owner_id,order_id,line_no,product_id,qty,price) VALUES (?,?,?,?,?,?)').bind(ownerId,order.id,lineNo,item.productId,item.qty,item.price));
    item.allocations.forEach((a,allocationNo)=>statements.push(db.prepare('INSERT INTO crm_rel_order_allocations (owner_id,order_id,line_no,allocation_no,batch_id,qty,unit_cost) VALUES (?,?,?,?,?,?,?)').bind(ownerId,order.id,lineNo,allocationNo,a.batchId,a.qty,a.unitCost)));
  });
  order.collections.forEach(c=>statements.push(db.prepare('INSERT INTO crm_rel_order_collections (owner_id,order_id,id,date,amount,reference) VALUES (?,?,?,?,?,?)').bind(ownerId,order.id,c.id,c.date,c.amount,c.reference)));
  return statements;
}

export async function createOrderRecord(ownerId:string,input:unknown,actor:OrderActor){
  const parsed=orderSchema.parse(input);
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  if(state.orders.some(order=>order.id===parsed.id))throw new Error('An order with this ID already exists.');
  const merged=finalizeOrderChange(state,proposedWithOrder(state,parsed,actor.role),actor.role);
  const order=merged.orders.find(item=>item.id===parsed.id)!;
  const now=new Date().toISOString(),nextWorkspaceVersion=row.version+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  const statements=[
    db.prepare('INSERT INTO crm_rel_orders (owner_id,id,number,customer_id,created,delivered,returned_at,settled_at,channel,payment,status,discount,delivery_charge,courier_cost,packaging,payment_fee,return_fee,settled,restocked,tracking,notes,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(ownerId,order.id,order.number,order.customerId,order.created,order.delivered||null,order.returnedAt||null,order.settledAt||null,order.channel,order.payment,order.status,order.discount,order.deliveryCharge,order.courierCost,order.packaging,order.paymentFee,order.returnFee,order.settled,order.restocked,order.tracking,order.notes,0,now,now),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_rel_orders WHERE owner_id=? AND id=? AND created_at=? AND record_version=0) THEN 1 ELSE 1/0 END").bind(ownerId,order.id,now),
    ...orderStatements(ownerId,order,0,now,false),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(merged),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,nextWorkspaceVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Created order '+order.number,JSON.stringify(['orders']),now)
  ];
  await db.batch(statements);
  return {...order,recordVersion:0} satisfies OrderRecord;
}

export async function updateOrderRecord(ownerId:string,id:string,input:unknown,expectedVersion:number,actor:OrderActor){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('A valid order record version is required.');
  const parsed=orderSchema.parse({...((input&&typeof input==='object')?input:{}),id});
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  const before=state.orders.find(order=>order.id===id);
  if(!before)throw new Error('Order not found.');
  const current=await database().prepare('SELECT record_version FROM crm_rel_orders WHERE owner_id=? AND id=?').bind(ownerId,id).first<{record_version:number}>();
  if(!current)throw new Error('Order not found.');
  if(Number(current.record_version)!==expectedVersion)throw new Error('ORDER_VERSION_CONFLICT');
  if(before.status!==parsed.status&&!nextStatuses(before).includes(parsed.status))throw new Error('Invalid order status transition for #'+before.number+'.');
  const merged=finalizeOrderChange(state,proposedWithOrder(state,parsed,actor.role),actor.role);
  const order=merged.orders.find(item=>item.id===id)!;
  const now=new Date().toISOString(),nextRecordVersion=expectedVersion+1,nextWorkspaceVersion=row.version+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  const statements=[
    db.prepare('UPDATE crm_rel_orders SET number=?,customer_id=?,created=?,delivered=?,returned_at=?,settled_at=?,channel=?,payment=?,status=?,discount=?,delivery_charge=?,courier_cost=?,packaging=?,payment_fee=?,return_fee=?,settled=?,restocked=?,tracking=?,notes=?,record_version=record_version+1,updated_at=? WHERE owner_id=? AND id=? AND record_version=?')
      .bind(order.number,order.customerId,order.created,order.delivered||null,order.returnedAt||null,order.settledAt||null,order.channel,order.payment,order.status,order.discount,order.deliveryCharge,order.courierCost,order.packaging,order.paymentFee,order.returnFee,order.settled,order.restocked,order.tracking,order.notes,now,ownerId,id,expectedVersion),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_rel_orders WHERE owner_id=? AND id=? AND record_version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,id,nextRecordVersion,now),
    ...orderStatements(ownerId,order,nextRecordVersion,now,true),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(merged),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,nextWorkspaceVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Updated order '+order.number,JSON.stringify(['orders']),now)
  ];
  await db.batch(statements);
  return {...order,recordVersion:nextRecordVersion} satisfies OrderRecord;
}

export async function deleteOrderRecord(ownerId:string,id:string,expectedVersion:number,actor:OrderActor){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('A valid order record version is required.');
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  const before=state.orders.find(order=>order.id===id);
  if(!before)throw new Error('Order not found.');
  const current=await database().prepare('SELECT record_version FROM crm_rel_orders WHERE owner_id=? AND id=?').bind(ownerId,id).first<{record_version:number}>();
  if(!current)throw new Error('Order not found.');
  if(Number(current.record_version)!==expectedVersion)throw new Error('ORDER_VERSION_CONFLICT');
  const merged=finalizeOrderChange(state,proposedWithoutOrder(state,id,actor.role),actor.role);
  const now=new Date().toISOString(),nextWorkspaceVersion=row.version+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  await db.batch([
    db.prepare('DELETE FROM crm_rel_orders WHERE owner_id=? AND id=? AND record_version=?').bind(ownerId,id,expectedVersion),
    db.prepare("SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM crm_rel_orders WHERE owner_id=? AND id=?) THEN 1 ELSE 1/0 END").bind(ownerId,id),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(merged),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END").bind(ownerId,nextWorkspaceVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Deleted order '+before.number,JSON.stringify(['orders']),now)
  ]);
  return {id};
}
