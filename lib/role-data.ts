import type { State } from './crm';
import type { WorkspaceRole } from './roles';
import { roleCanEdit } from './roles';

/** The CRM sends one state document; keep its shape while removing fields outside a role's work. */
export function visibleState(source:State,role:WorkspaceRole):State {
  if(role==='owner'||role==='admin'||role==='viewer')return source;
  const state=structuredClone(source);
  state.expenses=[];
  state.cashEntries=[];
  state.budget=0;
  if(role==='sales'){
    state.suppliers=[];
    state.products.forEach(p=>{p.cost=0});
    state.batches.forEach(b=>{b.unitCost=0;b.supplierId='';b.paid=false});
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
  const merged=structuredClone(current);
  for(const key of Object.keys(current) as (keyof State)[])
    if(roleCanEdit(role,key))(merged as any)[key]=proposed[key];
  if(role==='sales')restoreOrderCosts(merged,current);
  return merged;
}
