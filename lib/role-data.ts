import type { State } from './crm';
import type { WorkspaceRole } from './roles';
import { roleCanEdit } from './roles';

/** The CRM sends one state document; keep its shape while removing fields outside a role's work. */
export function visibleState(source:State,role:WorkspaceRole):State {
  if(role==='owner'||role==='admin'||role==='viewer')return source;
  const state=structuredClone(source);
  state.expenses=[];
  state.cashEntries=[];
  state.accountOpenings=[];
  state.accountMatches=[];
  state.budget=0;
  if(role==='sales'){
    state.suppliers=[];state.purchaseOrders=[];
    state.products.forEach(p=>{p.cost=0});
    state.batches.forEach(b=>{b.unitCost=0;b.supplierId='';b.paid=false;b.paidAt=undefined});
    state.orders.forEach(o=>o.items.forEach(i=>i.allocations.forEach(a=>{a.unitCost=0})));
  }else{
    state.customers=source.customers.map(c=>({...c,name:'Private customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false}));
    state.orders=source.orders.map(o=>({...o,number:'Private order',tracking:'',notes:'',discount:0,deliveryCharge:0,courierCost:0,packaging:0,paymentFee:0,returnFee:0,items:o.items.map(i=>({...i,price:0}))}));
    state.tasks=[];
  }
  return state;
}

/** Restore batch costs hidden from sales staff before validating newly created orders. */
export function restoreOrderCosts(next:State,current:State){
  for(const order of next.orders)for(const item of order.items)for(const allocation of item.allocations){
    const batch=current.batches.find(b=>b.id===allocation.batchId);
    if(batch)allocation.unitCost=batch.unitCost;
  }
}

export function applyRoleChanges(current:State,proposed:State,role:WorkspaceRole):State {
  const visible=visibleState(current,role);
  for(const key of Object.keys(current) as (keyof State)[]){
    if(!roleCanEdit(role,key)&&JSON.stringify(proposed[key])!==JSON.stringify(visible[key]))
      throw new Error('Your role cannot change '+key+'. Ask the owner to update your access.');
  }
  if(role==='sales'){
    const currentOrders=new Map(current.orders.map(o=>[o.id,o]));
    for(const order of proposed.orders){
      const before=currentOrders.get(order.id);
      if(before){
        const protectedBefore={number:before.number,customerId:before.customerId,created:before.created,channel:before.channel,payment:before.payment,items:before.items,discount:before.discount,deliveryCharge:before.deliveryCharge,collections:before.collections,settled:before.settled,settledAt:before.settledAt,courierCost:before.courierCost,packaging:before.packaging,paymentFee:before.paymentFee,returnFee:before.returnFee,restocked:before.restocked};
        const protectedAfter={number:order.number,customerId:order.customerId,created:order.created,channel:order.channel,payment:order.payment,items:order.items,discount:order.discount,deliveryCharge:order.deliveryCharge,collections:order.collections,settled:order.settled,settledAt:order.settledAt,courierCost:order.courierCost,packaging:order.packaging,paymentFee:order.paymentFee,returnFee:order.returnFee,restocked:order.restocked};
        if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw new Error('Sales staff can update order status, delivery/tracking and notes, but cannot rewrite order values, stock allocations or finance fields.');
      }else if(order.collections.length||order.settled||order.settledAt||order.courierCost||order.packaging||order.paymentFee||order.returnFee)throw new Error('Sales staff cannot create finance settlement data.');
    }
  }
  if(role==='inventory'){
    const currentBatches=new Map(current.batches.map(b=>[b.id,b]));
    for(const batch of proposed.batches){
      const before=currentBatches.get(batch.id);
      if(before){
        if(JSON.stringify({payments:before.payments,paid:before.paid,paidAt:before.paidAt})!==JSON.stringify({payments:batch.payments,paid:batch.paid,paidAt:batch.paidAt}))throw new Error('Inventory staff cannot change supplier payment fields.');
      }else if(batch.payments.length||batch.paid||batch.paidAt)throw new Error('Inventory staff cannot create supplier payment data.');
    }
  }
  const merged=structuredClone(current);
  for(const key of Object.keys(current) as (keyof State)[])
    if(roleCanEdit(role,key))(merged as any)[key]=proposed[key];
  if(role==='sales')restoreOrderCosts(merged,current);
  return merged;
}
