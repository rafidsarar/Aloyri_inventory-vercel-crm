import { validateRelations, type State } from './crm.ts';
import type { WorkspaceRole } from './roles.ts';
import { roleCanEdit } from './roles.ts';

/** The CRM sends one state document; keep its shape while removing fields outside a role's work. */
export function visibleState(source:State,role:WorkspaceRole):State {
  if(role==='owner'||role==='admin'||role==='finance'||role==='viewer')return source;
  const state=structuredClone(source);

  // Operational staff never need the finance ledger or month-close records in their browser.
  state.expenses=[];
  state.cashEntries=[];
  state.accountOpenings=[];
  state.accountMatches=[];
  state.financeCloses=[];
  state.customerRefunds=[];state.returnSettlements=[];state.creditUses=[];

  if(role==='sales'){
    // Sales needs stock availability for order allocation, but not supplier purchasing or cost/payment data.
    state.suppliers=[];
    state.purchaseOrders=[];
    state.products.forEach(p=>{p.cost=0});
    state.batches.forEach(b=>{
      b.unitCost=0;
      b.supplierId='';
      b.invoice='';
      b.dueDate=undefined;
      b.payments=[];
      b.paid=false;
      b.paidAt=undefined;
    });
    state.orders.forEach(o=>{
      o.items.forEach(i=>i.allocations.forEach(a=>{a.unitCost=0}));
      o.courierCost=0;
      o.packaging=0;
      o.paymentFee=0;
      o.returnFee=0;
      o.collections=[];
      o.settled=false;
      o.settledAt=undefined;
    });
  }else{
    // Inventory can manage stock and suppliers, but not customer identity, collections, or supplier payments.
    state.customers=source.customers.map(c=>({...c,name:'Private customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false}));
    state.orders=source.orders.map((o,index)=>({...o,number:'Private order '+String(index+1).padStart(4,'0'),tracking:'',notes:'',discount:0,deliveryCharge:0,courierCost:0,packaging:0,paymentFee:0,returnFee:0,collections:[],settled:false,settledAt:undefined,items:o.items.map(i=>({...i,price:0}))}));
    state.tasks=[];
    state.batches.forEach(b=>{b.payments=[];b.paid=false;b.paidAt=undefined});
  }
  return state;
}

/** Validate the state using the same role-aware rules in browser and server saves. */
export function validateRoleRelations(state:State,role:WorkspaceRole){
  validateRelations(state,{skipOrderNumberUniqueness:role==='inventory'});
}

/** Compare posted ledgers by record ID rather than API ordering.
 * Reject missing, duplicate, added, or changed posted entries, including for the owner.
 * Workflows that legitimately post new entries use dedicated validated endpoints.
 */
export function samePostedRecords<T extends {id:string}>(stored:readonly T[],submitted:readonly T[]):boolean {
  if(stored.length!==submitted.length)return false;
  const byId=new Map(stored.map(record=>[record.id,JSON.stringify(record)]));
  if(byId.size!==stored.length)return false;
  const seen=new Set<string>();
  return submitted.every(record=>{
    if(seen.has(record.id)||byId.get(record.id)!==JSON.stringify(record))return false;
    seen.add(record.id);
    return true;
  });
}

/** Allow untouched legacy duplicate order numbers, but reject any new/changed number collision. */
export function validateWorkspaceChange(current:State,next:State,options:{allowNewRefunds?:boolean;allowSettlements?:boolean;allowCreditUses?:boolean;allowInspections?:boolean}={}){
  if(!options.allowNewRefunds&&next.customerRefunds.some(r=>!current.customerRefunds.some(p=>p.id===r.id)))throw new Error('Use Record refund to post customer refunds.');
  for(const [key,allowed] of [['returnSettlements',options.allowSettlements],['creditUses',options.allowCreditUses],['returnInspections',options.allowInspections]] as const){
    for(const record of current[key])if(JSON.stringify(next[key].find(x=>x.id===record.id))!==JSON.stringify(record))throw new Error('Posted return and credit history cannot be changed or deleted.');
    if(!allowed&&next[key].some(x=>!current[key].some(p=>p.id===x.id)))throw new Error('Use the dedicated return or credit workflow.');
  }
  validateRelations(next,{skipOrderNumberUniqueness:true});
  for(const refund of current.customerRefunds){const after=next.customerRefunds.find(r=>r.id===refund.id);if(JSON.stringify(after)!==JSON.stringify(refund))throw new Error('Posted customer refund history cannot be changed or deleted.');}
  const refundedOrders=new Set([...current.customerRefunds,...current.returnSettlements].map(r=>r.orderId));
  for(const id of refundedOrders){const before=current.orders.find(o=>o.id===id),after=next.orders.find(o=>o.id===id);const financialIdentity=(o:State['orders'][number]|undefined)=>o?{number:o.number,customerId:o.customerId,payment:o.payment,items:o.items,discount:o.discount,deliveryCharge:o.deliveryCharge,collections:o.collections,settled:o.settled,settledAt:o.settledAt,delivered:o.delivered,returnedAt:o.returnedAt}:undefined;if(JSON.stringify(financialIdentity(before))!==JSON.stringify(financialIdentity(after)))throw new Error('Orders with posted refunds must retain their original customer, values and payment history.');}
  const beforeNumbers=new Map(current.orders.map(order=>[order.id,order.number.trim().toLowerCase()]));
  for(const order of next.orders){
    const number=order.number.trim().toLowerCase();
    if(beforeNumbers.get(order.id)===number)continue;
    if(next.orders.some(other=>other.id!==order.id&&other.number.trim().toLowerCase()===number))
      throw new Error('Order numbers must be unique.');
  }
}

/** Restore batch costs hidden from sales staff before validating newly created orders. */
export function restoreOrderCosts(next:State,current:State){
  for(const order of next.orders)for(const item of order.items)for(const allocation of item.allocations){
    const batch=current.batches.find(b=>b.id===allocation.batchId);
    if(batch)allocation.unitCost=batch.unitCost;
  }
}

/** Existing sales orders keep their protected commercial and finance fields on the server. */
function restoreSalesOrderProtectedFields(next:State,current:State){
  const currentOrders=new Map(current.orders.map(o=>[o.id,o]));
  for(const order of next.orders){
    const before=currentOrders.get(order.id);
    if(!before)continue;
    order.number=before.number;
    order.customerId=before.customerId;
    order.created=before.created;
    order.channel=before.channel;
    order.payment=before.payment;
    order.items=structuredClone(before.items);
    order.discount=before.discount;
    order.deliveryCharge=before.deliveryCharge;
    order.collections=structuredClone(before.collections);
    order.settled=before.settled;
    order.settledAt=before.settledAt;
    order.courierCost=before.courierCost;
    order.packaging=before.packaging;
    order.paymentFee=before.paymentFee;
    order.returnFee=before.returnFee;
    order.restocked=before.restocked;
  }
}

/** Inventory edits must not overwrite supplier-payment records that are hidden from inventory staff. */
function restoreInventoryPaymentFields(next:State,current:State){
  const currentBatches=new Map(current.batches.map(b=>[b.id,b]));
  for(const batch of next.batches){
    const before=currentBatches.get(batch.id);
    if(!before)continue;
    batch.payments=structuredClone(before.payments);
    batch.paid=before.paid;
    batch.paidAt=before.paidAt;
  }
}

export function applyRoleChanges(current:State,proposed:State,role:WorkspaceRole):State {
  const visible=visibleState(current,role);
  const postedKeys=['customerRefunds','returnSettlements','creditUses','returnInspections'] as const;
  // A caller may receive the relational ledger in a different order from the
  // compatibility workspace. Order is not permission to edit posted history.
  // All changes to these append-only ledgers must use their dedicated workflows.
  for(const key of postedKeys){
    if(!samePostedRecords(visible[key],proposed[key]))
      throw new Error('Use the dedicated return, refund or credit workflow to change '+key+'.');
  }
  for(const key of Object.keys(current) as (keyof State)[]){
    if((postedKeys as readonly string[]).includes(key))continue;
    if(!roleCanEdit(role,key)&&!(role==='inventory'&&key==='orders')&&JSON.stringify(proposed[key])!==JSON.stringify(visible[key]))
      throw new Error('Your role cannot change '+key+'. Ask the owner to update your access.');
  }

  if(role==='sales'){
    const currentOrders=new Map(current.orders.map(o=>[o.id,o]));
    const visibleOrders=new Map(visible.orders.map(o=>[o.id,o]));
    for(const before of current.orders)if(!proposed.orders.some(o=>o.id===before.id))throw new Error('Sales staff cannot delete existing orders.');
    for(const order of proposed.orders){
      const before=currentOrders.get(order.id);
      if(before){
        const beforeVisible=visibleOrders.get(order.id)!;
        const protectedBefore={number:beforeVisible.number,customerId:beforeVisible.customerId,created:beforeVisible.created,channel:beforeVisible.channel,payment:beforeVisible.payment,items:beforeVisible.items,discount:beforeVisible.discount,deliveryCharge:beforeVisible.deliveryCharge,collections:beforeVisible.collections,settled:beforeVisible.settled,settledAt:beforeVisible.settledAt,courierCost:beforeVisible.courierCost,packaging:beforeVisible.packaging,paymentFee:beforeVisible.paymentFee,returnFee:beforeVisible.returnFee,restocked:beforeVisible.restocked};
        const protectedAfter={number:order.number,customerId:order.customerId,created:order.created,channel:order.channel,payment:order.payment,items:order.items,discount:order.discount,deliveryCharge:order.deliveryCharge,collections:order.collections,settled:order.settled,settledAt:order.settledAt,courierCost:order.courierCost,packaging:order.packaging,paymentFee:order.paymentFee,returnFee:order.returnFee,restocked:order.restocked};
        if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw new Error('Sales staff can update order status, delivery/tracking and notes, but cannot rewrite order values, stock allocations or finance fields.');
      }else{
        if(order.status!=='New'||order.delivered||order.returnedAt)throw new Error('Sales staff must create orders in the New stage.');
        if(order.collections.length||order.settled||order.settledAt||order.courierCost||order.packaging||order.paymentFee||order.returnFee||order.restocked)
          throw new Error('Sales staff cannot create finance settlement or internal fulfillment-cost data.');
        for(const item of order.items){
          const product=current.products.find(p=>p.id===item.productId);
          if(!product||item.price!==product.price)throw new Error('Sales orders must use the current catalog price.');
        }
      }
    }
  }

  if(role==='inventory'){
    const visibleBatches=new Map(visible.batches.map(b=>[b.id,b]));
    for(const batch of proposed.batches){
      const beforeVisible=visibleBatches.get(batch.id);
      if(beforeVisible){
        if(JSON.stringify({payments:beforeVisible.payments,paid:beforeVisible.paid,paidAt:beforeVisible.paidAt})!==JSON.stringify({payments:batch.payments,paid:batch.paid,paidAt:batch.paidAt}))
          throw new Error('Inventory staff cannot change supplier payment fields.');
      }else if(batch.payments.length||batch.paid||batch.paidAt){
        throw new Error('Inventory staff cannot create supplier payment data.');
      }
    }
    if(proposed.orders.length!==visible.orders.length)throw new Error('Inventory staff cannot add or delete orders.');
    const visibleOrders=new Map(visible.orders.map(o=>[o.id,o]));
    for(const order of proposed.orders){
      const before=visibleOrders.get(order.id);
      if(!before)throw new Error('Inventory staff cannot add orders.');
      const beforeProtected={...before,restocked:false};
      const afterProtected={...order,restocked:false};
      if(JSON.stringify(beforeProtected)!==JSON.stringify(afterProtected))throw new Error('Inventory staff can only complete return inspection by restocking a returned order.');
      if(order.restocked!==before.restocked&&!(before.status==='Returned'&&!before.restocked&&order.restocked))
        throw new Error('Only a returned order awaiting inspection can be restocked.');
    }
  }

  const merged=structuredClone(current);
  for(const key of Object.keys(current) as (keyof State)[])
    if(roleCanEdit(role,key)&&!(postedKeys as readonly string[]).includes(key))(merged as any)[key]=proposed[key];

  if(role==='sales'){
    restoreSalesOrderProtectedFields(merged,current);
    restoreOrderCosts(merged,current);
  }
  if(role==='inventory'){
    restoreInventoryPaymentFields(merged,current);
    const proposedOrders=new Map(proposed.orders.map(o=>[o.id,o]));
    merged.orders=merged.orders.map(order=>{
      const proposedOrder=proposedOrders.get(order.id);
      return proposedOrder?.restocked!==order.restocked?{...order,restocked:proposedOrder!.restocked}:order;
    });
  }
  return merged;
}

