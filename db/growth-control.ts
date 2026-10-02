import { relationalCoreState } from './relational-cutover.ts';
import { accountBalance,accountIds,contribution,orderBalance,shiftDate,stock,subtotal,today,total,type State } from '../lib/crm.ts';

const round=(n:number)=>Math.round(n*100)/100;
const daysBetween=(from:string,to:string)=>Math.max(0,Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000));
const deliveredDate=(order:State['orders'][number])=>order.delivered||order.created;
const isOpen=(order:State['orders'][number])=>!['Delivered','Returned','Cancelled'].includes(order.status);
const isDelivered=(order:State['orders'][number])=>order.status==='Delivered';
const orderAge=(order:State['orders'][number])=>daysBetween(order.created,today());

export function customer360(state:State){
  return state.customers.map(customer=>{
    const all=state.orders.filter(order=>order.customerId===customer.id);
    const delivered=all.filter(isDelivered).sort((a,b)=>deliveredDate(a).localeCompare(deliveredDate(b)));
    const revenue=round(delivered.reduce((n,o)=>n+subtotal(o),0));
    const lifetimeValue=round(delivered.reduce((n,o)=>n+contribution(o),0));
    const outstanding=round(all.reduce((n,o)=>n+orderBalance(o),0));
    const last=delivered.at(-1);
    const lastPurchase=last?deliveredDate(last):null;
    const daysSince=lastPurchase?daysBetween(lastPurchase,today()):null;
    const openFollowUps=state.tasks.filter(task=>task.customerId===customer.id&&!task.done).length;
    const activeOrder=all.some(isOpen);
    const segment=!delivered.length?'new':delivered.length>=2&&daysSince!==null&&daysSince<=90?'repeat-active':daysSince!==null&&daysSince>120?'lapsed':daysSince!==null&&daysSince>75?'due-back':'active';
    return {
      customerId:customer.id,name:customer.name,phone:customer.phone,city:customer.city,consent:customer.consent,
      deliveredOrders:delivered.length,revenue,lifetimeValue,averageOrder:delivered.length?round(revenue/delivered.length):0,
      lastPurchase,daysSinceLastPurchase:daysSince,outstanding,openFollowUps,activeOrder,segment
    };
  }).sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name));
}

export function orderOperations(state:State){
  const open=state.orders.filter(isOpen);
  const aged=open.filter(order=>orderAge(order)>=3);
  const untracked=state.orders.filter(order=>['Shipped','Out for delivery'].includes(order.status)&&!order.tracking.trim());
  const deliveredUnpaid=state.orders.filter(order=>order.status==='Delivered'&&orderBalance(order)>.001);
  const returns30=state.orders.filter(order=>order.status==='Returned'&&(order.returnedAt||order.delivered||order.created)>=shiftDate(-29));
  const cancelled30=state.orders.filter(order=>order.status==='Cancelled'&&order.created>=shiftDate(-29));
  const queue=[
    ...aged.map(order=>({kind:'aged-order',severity:orderAge(order)>=7?'critical':'action',orderId:order.id,number:order.number,detail:orderAge(order)+' days open',value:total(order)})),
    ...untracked.map(order=>({kind:'tracking-missing',severity:'action',orderId:order.id,number:order.number,detail:order.status+' without tracking',value:total(order)})),
    ...deliveredUnpaid.map(order=>({kind:'collection-due',severity:'action',orderId:order.id,number:order.number,detail:'Delivered with '+orderBalance(order)+' outstanding',value:orderBalance(order)}))
  ].sort((a,b)=>(a.severity==='critical'?0:1)-(b.severity==='critical'?0:1)||b.value-a.value).slice(0,40);
  return {
    openOrders:open.length,agedOpen:aged.length,untrackedShipments:untracked.length,deliveredUnpaid:deliveredUnpaid.length,
    returns30:returns30.length,cancellations30:cancelled30.length,
    exceptionValue:round(queue.reduce((n,row)=>n+row.value,0)),queue
  };
}

export function inventoryPlanning(state:State){
  const since30=shiftDate(-29),since60=shiftDate(-59);
  const rows=state.products.filter(product=>product.active).map(product=>{
    const delivered=state.orders.filter(order=>isDelivered(order));
    const units30=delivered.filter(order=>deliveredDate(order)>=since30).reduce((n,o)=>n+o.items.filter(i=>i.productId===product.id).reduce((x,i)=>x+i.qty,0),0);
    const units60=delivered.filter(order=>deliveredDate(order)>=since60).reduce((n,o)=>n+o.items.filter(i=>i.productId===product.id).reduce((x,i)=>x+i.qty,0),0);
    const available=stock(state,product.id);
    const incoming=state.purchaseOrders.filter(po=>['Sent','Part received'].includes(po.status)).reduce((n,po)=>n+po.items.filter(i=>i.productId===product.id).reduce((x,i)=>x+Math.max(0,i.qty-i.receivedQty),0),0);
    const velocity=Math.max(units30/30,units60/60);
    const coverDays=velocity>0?Math.round(available/velocity):null;
    const target=Math.max(product.targetQty,Math.ceil(velocity*45));
    const suggestedReorder=Math.max(0,target-available-incoming);
    const expiring90=state.batches.filter(batch=>batch.productId===product.id&&batch.expiry>today()&&batch.expiry<=shiftDate(90)).reduce((n,b)=>n+Math.max(0,b.qty),0);
    const stale=available>0&&units60===0;
    const risk=available===0?'stock-out':suggestedReorder>0&&coverDays!==null&&coverDays<=21?'reorder-now':expiring90>0?'expiry':stale?'slow-moving':'healthy';
    return {productId:product.id,name:product.brand+' '+product.name,available,incoming,units30,units60,dailyVelocity:round(velocity),coverDays,suggestedReorder,expiring90,stale,risk};
  }).sort((a,b)=>{
    const rank:Record<string,number>={'stock-out':0,'reorder-now':1,expiry:2,'slow-moving':3,healthy:4};
    return rank[a.risk]-rank[b.risk]||(a.coverDays??9999)-(b.coverDays??9999);
  });
  return {
    rows,stockOuts:rows.filter(x=>x.risk==='stock-out').length,reorderNow:rows.filter(x=>x.risk==='reorder-now').length,
    expiryExposure:rows.filter(x=>x.risk==='expiry').length,slowMoving:rows.filter(x=>x.risk==='slow-moving').length
  };
}

export function supplierPerformance(state:State){
  return state.suppliers.map(supplier=>{
    const pos=state.purchaseOrders.filter(po=>po.supplierId===supplier.id);
    const received=pos.filter(po=>po.status==='Received');
    const open=pos.filter(po=>!['Received','Cancelled'].includes(po.status));
    const overdue=open.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today());
    const value=round(pos.filter(po=>po.status!=='Cancelled').reduce((n,po)=>n+po.items.reduce((x,i)=>x+i.qty*i.unitCost,0),0));
    const samples=received.map(po=>{
      const receipts=state.batches.filter(batch=>batch.supplierId===supplier.id&&batch.invoice===po.number);
      if(!receipts.length)return null;
      const final=[...receipts].sort((a,b)=>b.received.localeCompare(a.received))[0].received;
      return daysBetween(po.created,final);
    }).filter((v):v is number=>v!==null);
    const avgLeadDays=samples.length?Math.round(samples.reduce((n,v)=>n+v,0)/samples.length):null;
    const onTime=received.filter(po=>{
      const receipts=state.batches.filter(batch=>batch.supplierId===supplier.id&&batch.invoice===po.number);
      if(!receipts.length)return false;
      const final=[...receipts].sort((a,b)=>b.received.localeCompare(a.received))[0].received;
      return final<=po.expected;
    }).length;
    return {supplierId:supplier.id,name:supplier.name,orders:pos.length,received:received.length,open:open.length,overdue:overdue.length,value,avgLeadDays,onTimeRate:received.length?round(onTime/received.length*100):null};
  }).filter(row=>row.orders>0).sort((a,b)=>b.value-a.value);
}

export function financeControl(state:State){
  const receivables=state.orders.filter(order=>orderBalance(order)>.001).map(order=>{
    const base=order.delivered||order.created;
    return {orderId:order.id,number:order.number,age:daysBetween(base,today()),balance:round(orderBalance(order))};
  });
  const receivableBuckets={
    current:round(receivables.filter(x=>x.age<=7).reduce((n,x)=>n+x.balance,0)),
    days8to30:round(receivables.filter(x=>x.age>=8&&x.age<=30).reduce((n,x)=>n+x.balance,0)),
    days31plus:round(receivables.filter(x=>x.age>=31).reduce((n,x)=>n+x.balance,0))
  };
  const payables=state.batches.flatMap(batch=>{
    const amount=batch.qty*batch.unitCost;
    const legacy=batch.paid&&batch.payments.length===0?amount:0;
    const paid=legacy+batch.payments.reduce((n,p)=>n+p.amount,0);
    const balance=Math.max(0,amount-paid);
    if(balance<=.001)return [];
    const age=batch.dueDate?Math.max(0,daysBetween(batch.dueDate,today())):0;
    return [{batchId:batch.id,dueDate:batch.dueDate||null,age,balance:round(balance)}];
  });
  const payableBuckets={
    notOverdue:round(payables.filter(x=>!x.dueDate||x.dueDate>=today()).reduce((n,x)=>n+x.balance,0)),
    days1to30:round(payables.filter(x=>x.dueDate&&x.dueDate<today()&&x.age<=30).reduce((n,x)=>n+x.balance,0)),
    days31plus:round(payables.filter(x=>x.dueDate&&x.dueDate<today()&&x.age>=31).reduce((n,x)=>n+x.balance,0))
  };
  const delivered30=state.orders.filter(o=>isDelivered(o)&&deliveredDate(o)>=shiftDate(-29));
  const contribution30=round(delivered30.reduce((n,o)=>n+contribution(o),0));
  const expenses30=round(state.expenses.filter(e=>e.date>=shiftDate(-29)).reduce((n,e)=>n+e.amount,0));
  const profit30=round(contribution30-expenses30);
  return {
    receivables:round(receivables.reduce((n,x)=>n+x.balance,0)),receivableBuckets,
    payables:round(payables.reduce((n,x)=>n+x.balance,0)),payableBuckets,
    accounts:accountIds.map(account=>({account,balance:accountBalance(state,account)})),
    contribution30,expenses30,profit30
  };
}

export function prioritizeAlerts(state:State,orders:ReturnType<typeof orderOperations>,inventory:ReturnType<typeof inventoryPlanning>,finance:ReturnType<typeof financeControl>){
  const alerts:{severity:'critical'|'action'|'watch';area:string;title:string;detail:string;target:string}[]=[];
  if(inventory.stockOuts)alerts.push({severity:'critical',area:'Inventory',title:inventory.stockOuts+' active product(s) out of stock',detail:'Resolve active-demand stock-outs before accepting avoidable backorders.','target':'Inventory'});
  if(orders.agedOpen)alerts.push({severity:orders.agedOpen>=5?'critical':'action',area:'Orders',title:orders.agedOpen+' order(s) open for 3+ days',detail:'Review fulfillment blockers and move eligible orders forward.','target':'Orders'});
  if(finance.receivableBuckets.days31plus>0)alerts.push({severity:'critical',area:'Finance',title:'Receivables over 31 days need collection',detail:String(finance.receivableBuckets.days31plus)+' BDT remains outstanding beyond 31 days.','target':'Finances'});
  if(inventory.reorderNow)alerts.push({severity:'action',area:'Inventory',title:inventory.reorderNow+' product(s) need replenishment',detail:'Demand cover is 21 days or less after current incoming stock.','target':'Inventory'});
  if(inventory.expiryExposure)alerts.push({severity:'action',area:'Inventory',title:inventory.expiryExposure+' product(s) have expiry exposure',detail:'Review near-expiry stock before placing additional purchase orders.','target':'Inventory'});
  const dueTasks=state.tasks.filter(task=>!task.done&&task.due<=today()).length;
  if(dueTasks)alerts.push({severity:'action',area:'Customers',title:dueTasks+' follow-up(s) due',detail:'Work the existing internal follow-up queue; no customer messages are sent automatically.','target':'Follow-ups'});
  if(!alerts.length)alerts.push({severity:'watch',area:'Operations',title:'No high-priority operating exceptions',detail:'Continue monitoring fulfillment, stock cover, collections and customer retention.','target':'Overview'});
  const rank={critical:0,action:1,watch:2};
  return alerts.sort((a,b)=>rank[a.severity]-rank[b.severity]);
}

export async function buildGrowthControl(ownerId:string){
  const started=Date.now();
  const {state,version}=await relationalCoreState(ownerId);
  const customers=customer360(state);
  const orders=orderOperations(state);
  const inventory=inventoryPlanning(state);
  const suppliers=supplierPerformance(state);
  const finance=financeControl(state);
  const alerts=prioritizeAlerts(state,orders,inventory,finance);
  const delivered30=state.orders.filter(order=>isDelivered(order)&&deliveredDate(order)>=shiftDate(-29));
  const revenue30=round(delivered30.reduce((n,o)=>n+subtotal(o),0));
  const repeatCustomers=customers.filter(c=>c.deliveredOrders>=2).length;
  const customerWithSales=customers.filter(c=>c.deliveredOrders>0).length;
  const executive={
    revenue30,profit30:finance.profit30,openOrders:orders.openOrders,operationalExceptions:orders.queue.length+inventory.stockOuts+inventory.reorderNow,
    receivables:finance.receivables,payables:finance.payables,repeatRate:customerWithSales?round(repeatCustomers/customerWithSales*100):0,
    stockOuts:inventory.stockOuts,priorityAlerts:alerts.filter(a=>a.severity!=='watch').length
  };
  return {
    generatedAt:new Date().toISOString(),source:{architecture:'relational-core',workspaceVersion:version},
    executive,customers:{profiles:customers.slice(0,100),segments:{
      new:customers.filter(c=>c.segment==='new').length,active:customers.filter(c=>['active','repeat-active'].includes(c.segment)).length,
      dueBack:customers.filter(c=>c.segment==='due-back').length,lapsed:customers.filter(c=>c.segment==='lapsed').length
    }},
    orders,inventory,suppliers,finance,alerts,
    performance:{calculationMs:Date.now()-started,entities:state.customers.length+state.orders.length+state.products.length+state.suppliers.length+state.batches.length,indexReady:true}
  };
}
