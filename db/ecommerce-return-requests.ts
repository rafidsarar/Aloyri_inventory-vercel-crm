import { database } from './raw.ts';
import {
  fixedBusinessName,
  stateSchema,
  type Order,
  type State
} from '../lib/crm.ts';
import { normalizeBangladeshPhone } from '../lib/ecommerce-integration.ts';

export const returnRequestStatuses=['Requested','Reviewing','Approved','Rejected','Resolved'] as const;
export type ReturnRequestStatus=typeof returnRequestStatuses[number];

export const returnReasons=[
  'Wrong product delivered',
  'Damaged on arrival',
  'Missing item',
  'Product issue',
  'Changed mind',
  'Other'
] as const;

export const returnConditions=[
  'Unopened',
  'Opened',
  'Damaged in delivery',
  'Not received',
  'Other'
] as const;

export const returnResolutions=['Refund','Replacement','Store credit','Other'] as const;

export type PublicReturnLine={
  line:number;
  productId:string;
  name:string;
  brand:string;
  size:string;
  qty:number;
};

export type ReturnRequestRecord={
  id:string;
  orderId:string;
  orderNumber:string;
  requestStatus:ReturnRequestStatus;
  reason:string;
  condition:string;
  preferredResolution:string;
  customerNote:string;
  items:PublicReturnLine[];
  staffNote:string;
  createdAt:string;
  updatedAt:string;
  resolvedAt:string;
};

type WorkspaceRow={data:string};
type DbRow={
  id:string;
  order_id:string;
  order_number:string;
  request_status:string;
  reason:string;
  condition:string;
  preferred_resolution:string;
  customer_note:string;
  items_json:string;
  staff_note:string;
  created_at:string;
  updated_at:string;
  resolved_at:string|null;
};

async function readState(ownerId:string){
  const row=await database().prepare(
    'SELECT data FROM crm_workspaces WHERE owner_id=?'
  ).bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');
  return fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
}

function matchedWebsiteOrder(state:State,orderNumber:string,phone:string){
  const normalizedOrder=orderNumber.trim().toLowerCase();
  const normalizedPhone=normalizeBangladeshPhone(phone);
  const order=state.orders.find(candidate=>
    candidate.channel==='Website' &&
    candidate.number.trim().toLowerCase()===normalizedOrder
  );
  if(!order)return null;
  const customer=state.customers.find(candidate=>candidate.id===order.customerId);
  if(!customer || normalizeBangladeshPhone(customer.phone)!==normalizedPhone)return null;
  return order;
}

function publicLines(state:State,order:Order,requested:{line:number;qty:number}[]){
  return requested.map(item=>{
    const source=order.items[item.line];
    if(!source)throw new Error('INVALID_RETURN_ITEMS');
    if(!Number.isInteger(item.qty)||item.qty<1||item.qty>source.qty)throw new Error('INVALID_RETURN_ITEMS');
    const product=state.products.find(candidate=>candidate.id===source.productId);
    return {
      line:item.line,
      productId:source.productId,
      name:product?.name||'Skincare product',
      brand:product?.brand||'',
      size:product?.size||'',
      qty:item.qty
    };
  });
}

function mapRow(row:DbRow):ReturnRequestRecord{
  return {
    id:row.id,
    orderId:row.order_id,
    orderNumber:row.order_number,
    requestStatus:row.request_status as ReturnRequestStatus,
    reason:row.reason,
    condition:row.condition,
    preferredResolution:row.preferred_resolution,
    customerNote:row.customer_note,
    items:JSON.parse(row.items_json) as PublicReturnLine[],
    staffNote:row.staff_note,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
    resolvedAt:row.resolved_at||''
  };
}

export async function createEcommerceReturnRequest(input:{
  ownerId:string;
  orderNumber:string;
  phone:string;
  reason:string;
  condition:string;
  preferredResolution:string;
  note:string;
  items:{line:number;qty:number}[];
}){
  const state=await readState(input.ownerId);
  const order=matchedWebsiteOrder(state,input.orderNumber,input.phone);
  if(!order)throw new Error('RETURN_ORDER_NOT_FOUND');
  if(!['Delivered','Returned'].includes(order.status))throw new Error('RETURN_ORDER_NOT_ELIGIBLE');
  if(!returnReasons.includes(input.reason as any) ||
     !returnConditions.includes(input.condition as any) ||
     !returnResolutions.includes(input.preferredResolution as any)){
    throw new Error('INVALID_RETURN_REQUEST');
  }
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>order.items.length){
    throw new Error('INVALID_RETURN_ITEMS');
  }
  const unique=[...new Map(input.items.map(item=>[item.line,item])).values()];
  if(unique.length!==input.items.length)throw new Error('INVALID_RETURN_ITEMS');
  const items=publicLines(state,order,unique);

  const db=database();
  const existing=await db.prepare(
    'SELECT id,order_id,order_number,request_status,reason,condition,preferred_resolution,customer_note,items_json,staff_note,created_at,updated_at,resolved_at FROM crm_ecommerce_return_requests WHERE owner_id=? AND order_id=?'
  ).bind(input.ownerId,order.id).first<DbRow>();
  if(existing)return {duplicate:true,request:mapRow(existing)};

  const now=new Date().toISOString(),id=crypto.randomUUID();
  await db.prepare(
    'INSERT INTO crm_ecommerce_return_requests '+
    '(id,owner_id,order_id,order_number,request_status,reason,condition,preferred_resolution,customer_note,items_json,staff_note,created_at,updated_at,resolved_at) '+
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    id,input.ownerId,order.id,order.number,'Requested',input.reason,input.condition,
    input.preferredResolution,input.note.trim(),JSON.stringify(items),'',now,now,null
  ).run();

  return {
    duplicate:false,
    request:{
      id,orderId:order.id,orderNumber:order.number,requestStatus:'Requested' as const,
      reason:input.reason,condition:input.condition,preferredResolution:input.preferredResolution,
      customerNote:input.note.trim(),items,staffNote:'',createdAt:now,updatedAt:now,resolvedAt:''
    }
  };
}

export async function listEcommerceReturnRequests(ownerId:string){
  const rows=await database().prepare(
    'SELECT id,order_id,order_number,request_status,reason,condition,preferred_resolution,customer_note,items_json,staff_note,created_at,updated_at,resolved_at '+
    'FROM crm_ecommerce_return_requests WHERE owner_id=? ORDER BY '+
    "CASE request_status WHEN 'Requested' THEN 0 WHEN 'Reviewing' THEN 1 WHEN 'Approved' THEN 2 WHEN 'Rejected' THEN 3 WHEN 'Resolved' THEN 4 ELSE 9 END, created_at DESC"
  ).bind(ownerId).all<DbRow>();
  return rows.results.map(mapRow);
}

export async function updateEcommerceReturnRequest(
  ownerId:string,
  id:string,
  input:{status:ReturnRequestStatus;staffNote:string},
  actor:{userId:string;name:string;role:string}
){
  if(!returnRequestStatuses.includes(input.status))throw new Error('INVALID_RETURN_REQUEST_STATUS');
  if(input.staffNote.length>2000)throw new Error('INVALID_RETURN_REQUEST_NOTE');
  const db=database(),now=new Date().toISOString();
  const before=await db.prepare(
    'SELECT id,order_id,order_number,request_status,reason,condition,preferred_resolution,customer_note,items_json,staff_note,created_at,updated_at,resolved_at FROM crm_ecommerce_return_requests WHERE owner_id=? AND id=?'
  ).bind(ownerId,id).first<DbRow>();
  if(!before)throw new Error('RETURN_REQUEST_NOT_FOUND');

  const resolved=['Rejected','Resolved'].includes(input.status)?now:null;
  const updated=await db.prepare(
    'UPDATE crm_ecommerce_return_requests SET request_status=?,staff_note=?,updated_at=?,resolved_at=? WHERE owner_id=? AND id=? '+
    'RETURNING id,order_id,order_number,request_status,reason,condition,preferred_resolution,customer_note,items_json,staff_note,created_at,updated_at,resolved_at'
  ).bind(input.status,input.staffNote.trim(),now,resolved,ownerId,id).first<DbRow>();
  if(!updated)throw new Error('RETURN_REQUEST_NOT_FOUND');

  await db.prepare(
    'INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(
    crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,
    'Updated website return request for '+before.order_number+' to '+input.status,
    JSON.stringify(['orders','ecommerceReturnRequests']),now
  ).run();

  return mapRow(updated);
}
