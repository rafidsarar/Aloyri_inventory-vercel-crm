import { database } from './raw.ts';
import { ensureCustomerRecordApiReady } from './customer-records.ts';
import { CUSTOMER_ORDER_DOMAIN } from './customer-order-shadow.ts';
import { validateWorkspaceChange } from '../lib/role-data.ts';
import {
  attemptImmediateCustomerNotifications,
  initialWebsiteNotificationStatements
} from './customer-notifications.ts';
import {
  batchRemaining,
  customerSchema,
  orderSchema,
  today,
  type Order,
  type State
} from '../lib/crm.ts';
import {
  ecommerceDeliveryCharge,
  normalizeBangladeshPhone,
  validBangladeshPhone,
  type EcommerceOrderInput
} from '../lib/ecommerce-integration.ts';

type PriorRequest={payload_hash:string;response_json:string};
type CustomerVersionRow={record_version:number};

export type EcommerceOrderResponse={
  orderId:string;
  orderNumber:string;
  customerId:string;
  status:'New';
  payment:'COD';
  productsSubtotal:number;
  deliveryCharge:number;
  total:number;
  duplicate?:boolean;
};

function rounded(value:number){return Math.round(value*100)/100}

function findCustomerByPhone(state:State,phone:string){
  return state.customers.find(customer=>normalizeBangladeshPhone(customer.phone)===phone);
}

function customerIdFor(phone:string,externalOrderId:string,state:State){
  const base='web-customer-'+phone.replace(/\D/g,'');
  const existing=state.customers.find(customer=>customer.id===base);
  if(!existing)return base;
  if(normalizeBangladeshPhone(existing.phone)===phone)return existing.id;
  return base+'-'+externalOrderId.replace(/[^A-Za-z0-9]/g,'').slice(0,10);
}

function allocateItems(state:State,requested:EcommerceOrderInput['items']){
  const combined=new Map<string,number>();
  for(const item of requested)combined.set(item.productId,(combined.get(item.productId)||0)+item.qty);
  const items:Order['items']=[];
  for(const [productId,qty] of combined){
    const product=state.products.find(candidate=>candidate.id===productId);
    if(!product||!product.active)throw new Error('PRODUCT_UNAVAILABLE:'+productId);
    const candidates=state.batches
      .filter(batch=>batch.productId===productId&&batch.expiry>today()&&batchRemaining(state,batch)>0)
      .sort((a,b)=>a.expiry.localeCompare(b.expiry)||a.received.localeCompare(b.received)||a.id.localeCompare(b.id));
    let remaining=qty;
    const allocations:Order['items'][number]['allocations']=[];
    for(const batch of candidates){
      if(remaining<=0)break;
      const available=Math.max(0,batchRemaining(state,batch));
      const take=Math.min(remaining,available);
      if(take>0)allocations.push({batchId:batch.id,qty:take,unitCost:batch.unitCost});
      remaining-=take;
    }
    if(remaining>0)throw new Error('OUT_OF_STOCK:'+product.name);
    items.push({productId,qty,price:product.price,allocations});
  }
  return items;
}

function orderNotes(input:EcommerceOrderInput){
  const lines=[
    'Website order',
    'Delivery zone: '+(input.deliveryZone==='inside-dhaka'?'Inside Dhaka':'Outside Dhaka'),
    'Delivery address: '+input.customer.address,
    'Area: '+input.customer.area+', '+input.customer.district
  ];
  if(input.customer.landmark)lines.push('Landmark: '+input.customer.landmark);
  if(input.customer.notes)lines.push('Customer note: '+input.customer.notes);
  return lines.join('\n').slice(0,2000);
}

async function ensureAuditTable(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

async function priorRequest(ownerId:string,integrationId:string,idempotencyKey:string,externalOrderId:string){
  return database().prepare(
    'SELECT payload_hash,response_json FROM crm_ecommerce_requests WHERE owner_id=? AND integration_id=? AND (idempotency_key=? OR external_order_id=?) ORDER BY created_at DESC LIMIT 1'
  ).bind(ownerId,integrationId,idempotencyKey,externalOrderId).first<PriorRequest>();
}

export async function createEcommerceOrder(input:{
  ownerId:string;
  integrationId:string;
  idempotencyKey:string;
  payloadHash:string;
  order:EcommerceOrderInput;
}):Promise<EcommerceOrderResponse>{
  const previous=await priorRequest(input.ownerId,input.integrationId,input.idempotencyKey,input.order.externalOrderId);
  if(previous){
    if(previous.payload_hash!==input.payloadHash)throw new Error('IDEMPOTENCY_CONFLICT');
    return {...JSON.parse(previous.response_json) as EcommerceOrderResponse,duplicate:true};
  }

  if(input.order.paymentMethod!=='COD')throw new Error('ONLINE_PAYMENT_NOT_READY');
  const phone=normalizeBangladeshPhone(input.order.customer.phone);
  if(!validBangladeshPhone(phone))throw new Error('INVALID_CUSTOMER_PHONE');
  const deliveryCharge=ecommerceDeliveryCharge(input.order.deliveryZone);
  const {row,state}=await ensureCustomerRecordApiReady(input.ownerId);
  const next=structuredClone(state);

  const existing=findCustomerByPhone(state,phone);
  const customerId=existing?.id||customerIdFor(phone,input.order.externalOrderId,state);
  const nextCustomer=customerSchema.parse({
    id:customerId,
    name:input.order.customer.name,
    phone,
    address:input.order.customer.address,
    city:input.order.customer.district,
    preference:existing?.preference||'Website',
    notes:existing?.notes||'',
    consent:existing?.consent||false,
    created:existing?.created||today()
  });

  if(existing){
    const index=next.customers.findIndex(customer=>customer.id===existing.id);
    next.customers[index]=nextCustomer;
  }else{
    next.customers.push(nextCustomer);
  }

  const items=allocateItems(state,input.order.items);
  const safeExternal=input.order.externalOrderId.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  const orderId='web-order-'+input.order.externalOrderId;
  const number='WEB-'+today().replace(/-/g,'')+'-'+safeExternal.slice(0,16);
  const order=orderSchema.parse({
    id:orderId,
    number,
    customerId,
    created:today(),
    collections:[],
    channel:'Website',
    payment:'COD',
    status:'New',
    items,
    discount:0,
    deliveryCharge,
    courierCost:0,
    packaging:0,
    paymentFee:0,
    returnFee:0,
    settled:false,
    restocked:false,
    tracking:'',
    notes:orderNotes(input.order)
  });
  if(state.orders.some(candidate=>candidate.id===order.id))throw new Error('IDEMPOTENCY_CONFLICT');
  next.orders.unshift(order);
  validateWorkspaceChange(state,next);

  const productsSubtotal=rounded(order.items.reduce((sum,item)=>sum+item.qty*item.price,0));
  const total=rounded(productsSubtotal+deliveryCharge);
  const response:EcommerceOrderResponse={
    orderId:order.id,
    orderNumber:order.number,
    customerId,
    status:'New',
    payment:'COD',
    productsSubtotal,
    deliveryCharge,
    total
  };

  const now=new Date().toISOString(),nextVersion=row.version+1,db=database();
  await ensureAuditTable();
  const statements:any[]=[];

  if(existing){
    const version=await db.prepare('SELECT record_version FROM crm_rel_customers WHERE owner_id=? AND id=?')
      .bind(input.ownerId,existing.id).first<CustomerVersionRow>();
    if(!version)throw new Error('CUSTOMER_VERSION_CONFLICT');
    const nextCustomerVersion=Number(version.record_version)+1;
    statements.push(
      db.prepare('UPDATE crm_rel_customers SET name=?,phone=?,address=?,city=?,preference=?,notes=?,consent=?,created=?,record_version=record_version+1,updated_at=? WHERE owner_id=? AND id=? AND record_version=?')
        .bind(nextCustomer.name,nextCustomer.phone,nextCustomer.address,nextCustomer.city,nextCustomer.preference,nextCustomer.notes,nextCustomer.consent,nextCustomer.created,now,input.ownerId,nextCustomer.id,Number(version.record_version)),
      db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_rel_customers WHERE owner_id=? AND id=? AND record_version=? AND updated_at=?) THEN 1 ELSE 0 END")
        .bind(input.ownerId,nextCustomer.id,nextCustomerVersion,now)
    );
  }else{
    statements.push(
      db.prepare('INSERT INTO crm_rel_customers (owner_id,id,name,phone,address,city,preference,notes,consent,created,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(input.ownerId,nextCustomer.id,nextCustomer.name,nextCustomer.phone,nextCustomer.address,nextCustomer.city,nextCustomer.preference,nextCustomer.notes,nextCustomer.consent,nextCustomer.created,0,now,now)
    );
  }

  statements.push(
    ...initialWebsiteNotificationStatements({
      ownerId:input.ownerId,
      order,
      email:input.order.customer.email,
      phone,
      now
    }),
    db.prepare('INSERT INTO crm_rel_orders (owner_id,id,number,customer_id,created,delivered,returned_at,settled_at,channel,payment,status,discount,delivery_charge,courier_cost,packaging,payment_fee,return_fee,settled,restocked,tracking,notes,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(input.ownerId,order.id,order.number,order.customerId,order.created,null,null,null,order.channel,order.payment,order.status,order.discount,order.deliveryCharge,order.courierCost,order.packaging,order.paymentFee,order.returnFee,order.settled,order.restocked,order.tracking,order.notes,0,now,now)
  );
  order.items.forEach((item,lineNo)=>{
    statements.push(db.prepare('INSERT INTO crm_rel_order_items (owner_id,order_id,line_no,product_id,qty,price) VALUES (?,?,?,?,?,?)')
      .bind(input.ownerId,order.id,lineNo,item.productId,item.qty,item.price));
    item.allocations.forEach((allocation,allocationNo)=>{
      statements.push(db.prepare('INSERT INTO crm_rel_order_allocations (owner_id,order_id,line_no,allocation_no,batch_id,qty,unit_cost) VALUES (?,?,?,?,?,?,?)')
        .bind(input.ownerId,order.id,lineNo,allocationNo,allocation.batchId,allocation.qty,allocation.unitCost));
    });
  });
  statements.push(
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
      .bind(JSON.stringify(next),now,input.ownerId,row.version),
    db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END")
      .bind(input.ownerId,nextVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?')
      .bind('verified',nextVersion,now,now,input.ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),input.ownerId,'integration:'+input.integrationId,'Aloyri Website','integration','Created website order '+order.number,JSON.stringify(existing?['customers','orders']:['customers','orders']),now),
    db.prepare('INSERT INTO crm_ecommerce_requests (owner_id,integration_id,idempotency_key,external_order_id,payload_hash,crm_order_id,response_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(input.ownerId,input.integrationId,input.idempotencyKey,input.order.externalOrderId,input.payloadHash,order.id,JSON.stringify(response),now)
  );
  await db.batch(statements);
  await attemptImmediateCustomerNotifications(input.ownerId);
  return response;
}
