import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';
import type { State } from '../lib/crm.ts';

export const CUSTOMER_ORDER_DOMAIN='customers-orders';

export type ShadowMetrics={
  customers:number;
  orders:number;
  items:number;
  allocations:number;
  collections:number;
  orderValue:number;
  collectionValue:number;
};

const roundMoney=(value:number)=>Math.round(value*100)/100;

export function customerOrderShadowMetrics(state:Pick<State,'customers'|'orders'>):ShadowMetrics{
  let items=0,allocations=0,collections=0,orderValue=0,collectionValue=0;
  for(const order of state.orders){
    items+=order.items.length;
    collections+=order.collections.length;
    orderValue+=order.items.reduce((sum,item)=>sum+item.qty*item.price,0)-order.discount+order.deliveryCharge;
    collectionValue+=order.collections.reduce((sum,collection)=>sum+collection.amount,0);
    for(const item of order.items)allocations+=item.allocations.length;
  }
  return {
    customers:state.customers.length,
    orders:state.orders.length,
    items,
    allocations,
    collections,
    orderValue:roundMoney(orderValue),
    collectionValue:roundMoney(collectionValue)
  };
}

export function customerOrderShadowIds(state:Pick<State,'customers'|'orders'>){
  return {
    customers:[...state.customers.map(customer=>customer.id)].sort(),
    orders:[...state.orders.map(order=>order.id)].sort(),
    references:[...state.orders.map(order=>order.id+'|'+order.number+'|'+order.customerId)].sort()
  };
}

type CountRow={count:string|number};
type SumRow={value:string|number|null};
type CustomerRow={id:string};
type OrderRefRow={id:string;number:string;customer_id:string};

async function readShadowVerification(ownerId:string){
  const db=database();
  const [
    customersRow,ordersRow,itemsRow,allocationsRow,collectionsRow,
    orderValueRow,collectionValueRow,customersResult,ordersResult
  ]=await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM crm_rel_customers WHERE owner_id=?').bind(ownerId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) AS count FROM crm_rel_orders WHERE owner_id=?').bind(ownerId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) AS count FROM crm_rel_order_items WHERE owner_id=?').bind(ownerId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) AS count FROM crm_rel_order_allocations WHERE owner_id=?').bind(ownerId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) AS count FROM crm_rel_order_collections WHERE owner_id=?').bind(ownerId).first<CountRow>(),
    db.prepare('SELECT COALESCE(SUM((i.qty*i.price)),0)-COALESCE((SELECT SUM(o.discount-o.delivery_charge) FROM crm_rel_orders o WHERE o.owner_id=?),0) AS value FROM crm_rel_order_items i WHERE i.owner_id=?').bind(ownerId,ownerId).first<SumRow>(),
    db.prepare('SELECT COALESCE(SUM(amount),0) AS value FROM crm_rel_order_collections WHERE owner_id=?').bind(ownerId).first<SumRow>(),
    db.prepare('SELECT id FROM crm_rel_customers WHERE owner_id=? ORDER BY id').bind(ownerId).all<CustomerRow>(),
    db.prepare('SELECT id,number,customer_id FROM crm_rel_orders WHERE owner_id=? ORDER BY id').bind(ownerId).all<OrderRefRow>()
  ]);
  return {
    metrics:{
      customers:Number(customersRow?.count||0),
      orders:Number(ordersRow?.count||0),
      items:Number(itemsRow?.count||0),
      allocations:Number(allocationsRow?.count||0),
      collections:Number(collectionsRow?.count||0),
      orderValue:roundMoney(Number(orderValueRow?.value||0)),
      collectionValue:roundMoney(Number(collectionValueRow?.value||0))
    } satisfies ShadowMetrics,
    ids:{
      customers:customersResult.results.map(row=>row.id),
      orders:ordersResult.results.map(row=>row.id),
      references:ordersResult.results.map(row=>row.id+'|'+row.number+'|'+row.customer_id).sort()
    }
  };
}

export function verificationMatches(
  expected:{metrics:ShadowMetrics;ids:ReturnType<typeof customerOrderShadowIds>},
  actual:{metrics:ShadowMetrics;ids:ReturnType<typeof customerOrderShadowIds>}
){
  return JSON.stringify(expected)===JSON.stringify(actual);
}

export async function migrateCustomersOrdersShadow(ownerId:string,state:State,sourceVersion:number){
  if(!ownerId)throw new Error('Owner is required for relational migration.');
  if(!Number.isInteger(sourceVersion)||sourceVersion<0)throw new Error('A valid workspace version is required for relational migration.');
  await ensureRelationalFoundation();
  const db=database();
  const now=new Date().toISOString();
  const statements=[
    db.prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,migrated_at=EXCLUDED.migrated_at,verified_at=EXCLUDED.verified_at,updated_at=EXCLUDED.updated_at').bind(ownerId,CUSTOMER_ORDER_DOMAIN,'migrating',sourceVersion,now,null,now),
    db.prepare('DELETE FROM crm_rel_order_allocations WHERE owner_id=?').bind(ownerId),
    db.prepare('DELETE FROM crm_rel_order_collections WHERE owner_id=?').bind(ownerId),
    db.prepare('DELETE FROM crm_rel_order_items WHERE owner_id=?').bind(ownerId),
    db.prepare('DELETE FROM crm_rel_orders WHERE owner_id=?').bind(ownerId),
    db.prepare('DELETE FROM crm_rel_customers WHERE owner_id=?').bind(ownerId)
  ];
  for(const customer of state.customers){
    statements.push(db.prepare('INSERT INTO crm_rel_customers (owner_id,id,name,phone,address,city,preference,notes,consent,created,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(ownerId,customer.id,customer.name,customer.phone,customer.address,customer.city,customer.preference,customer.notes,customer.consent,customer.created,sourceVersion,now,now));
  }
  for(const order of state.orders){
    statements.push(db.prepare('INSERT INTO crm_rel_orders (owner_id,id,number,customer_id,created,delivered,returned_at,settled_at,channel,payment,status,discount,delivery_charge,courier_cost,packaging,payment_fee,return_fee,settled,restocked,tracking,notes,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(ownerId,order.id,order.number,order.customerId,order.created,order.delivered||null,order.returnedAt||null,order.settledAt||null,order.channel,order.payment,order.status,order.discount,order.deliveryCharge,order.courierCost,order.packaging,order.paymentFee,order.returnFee,order.settled,order.restocked,order.tracking,order.notes,sourceVersion,now,now));
    order.items.forEach((item,lineNo)=>{
      statements.push(db.prepare('INSERT INTO crm_rel_order_items (owner_id,order_id,line_no,product_id,qty,price) VALUES (?,?,?,?,?,?)')
        .bind(ownerId,order.id,lineNo,item.productId,item.qty,item.price));
      item.allocations.forEach((allocation,allocationNo)=>{
        statements.push(db.prepare('INSERT INTO crm_rel_order_allocations (owner_id,order_id,line_no,allocation_no,batch_id,qty,unit_cost) VALUES (?,?,?,?,?,?,?)')
          .bind(ownerId,order.id,lineNo,allocationNo,allocation.batchId,allocation.qty,allocation.unitCost));
      });
    });
    for(const collection of order.collections){
      statements.push(db.prepare('INSERT INTO crm_rel_order_collections (owner_id,order_id,id,date,amount,reference) VALUES (?,?,?,?,?,?)')
        .bind(ownerId,order.id,collection.id,collection.date,collection.amount,collection.reference));
    }
  }
  await db.batch(statements);

  const expected={metrics:customerOrderShadowMetrics(state),ids:customerOrderShadowIds(state)};
  const actual=await readShadowVerification(ownerId);
  const verified=verificationMatches(expected,actual);
  const verifiedAt=verified?new Date().toISOString():null;
  await db.prepare('UPDATE crm_relational_migrations SET status=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?')
    .bind(verified?'verified':'mismatch',verifiedAt,new Date().toISOString(),ownerId,CUSTOMER_ORDER_DOMAIN).run();
  if(!verified)throw new Error('Relational shadow verification did not match the workspace source.');
  return {domain:CUSTOMER_ORDER_DOMAIN,sourceVersion,status:'verified' as const,verifiedAt,metrics:actual.metrics};
}

export async function getCustomersOrdersMigrationStatus(ownerId:string){
  await ensureRelationalFoundation();
  return database().prepare('SELECT domain,status,source_version,migrated_at,verified_at,updated_at FROM crm_relational_migrations WHERE owner_id=? AND domain=?')
    .bind(ownerId,CUSTOMER_ORDER_DOMAIN)
    .first<{domain:string;status:string;source_version:number;migrated_at:string|null;verified_at:string|null;updated_at:string}|null>();
}


export function customerOrderSectionsChanged(previous:Pick<State,'customers'|'orders'>,next:Pick<State,'customers'|'orders'>){
  return JSON.stringify(previous.customers)!==JSON.stringify(next.customers)
    || JSON.stringify(previous.orders)!==JSON.stringify(next.orders);
}

export async function markCustomersOrdersShadowStale(ownerId:string,sourceVersion:number){
  await ensureRelationalFoundation();
  const now=new Date().toISOString();
  await database().prepare(
    'INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=EXCLUDED.verified_at,updated_at=EXCLUDED.updated_at'
  ).bind(ownerId,CUSTOMER_ORDER_DOMAIN,'stale',sourceVersion,null,null,now).run();
}
