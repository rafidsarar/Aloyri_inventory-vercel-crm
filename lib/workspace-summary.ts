import { financialPeriod,financialMonths,periodSalesBreakdown } from './financial-reporting.ts';
import { type State,type Product,type Order,type Customer,type Task,initialState,uid,today,shiftDate,taka,dateLabel,stock,batchRemaining,stockPosition,metrics,cashflow,subtotal,total,customerRefundPayable,receivable,collectedAmount,orderBalance,orderPaymentStatus,contribution,purchaseOrderValue,purchaseOrderUnits,purchaseOrderReceivedUnits,purchaseOrderOutstandingUnits,purchaseOrderProgress,supplierInsight,automationSignals,statuses,nextStatuses,stateSchema,accountIds,accountNames,accountBalance,type AutomationSettings } from './crm.ts';
import type { WorkspaceRole } from './roles.ts';
import type { View } from '../app/crm-ui.tsx';
import type { AutoAlert } from '../app/crm-sections/alerts.tsx';
const calculate=<T>(fn:()=>T,_deps:unknown[])=>fn();
const isCollectible=(o:Order)=>o.status==='Delivered'||(o.payment!=='COD'&&!['Cancelled','Returned'].includes(o.status));
export function workspaceSummary(s:State,role:WorkspaceRole,reportMonth=today().slice(0,7),range='7'){
const filter='All',deferredQuery='',cashRange:string='30',closeMonth=reportMonth,alertFilter='All';
const m=calculate(()=>metrics(s),[s]);const flow=calculate(()=>cashflow(s),[s]);
const customerById=calculate(()=>new Map(s.customers.map(x=>[x.id,x])),[s.customers]);
const productById=calculate(()=>new Map(s.products.map(x=>[x.id,x])),[s.products]);
const supplierById=calculate(()=>new Map(s.suppliers.map(x=>[x.id,x])),[s.suppliers]);
const orderById=calculate(()=>new Map(s.orders.map(x=>[x.id,x])),[s.orders]);const visibleCash=flow.entries.filter(e=>cashRange==='all'||e.date>=shiftDate(-29));const visibleExternalCash=visibleCash.filter(e=>e.source!=='Transfer');const cashIn=visibleExternalCash.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0);const cashOut=visibleExternalCash.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0);const activeProducts=s.products.filter(p=>p.active);const stockedProducts=activeProducts.filter(p=>stock(s,p.id)>0);const low=activeProducts.filter(p=>s.batches.some(b=>b.productId===p.id)&&stock(s,p.id)<=p.reorderAt);const expiring=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry<=shiftDate(90));const due=s.tasks.filter(t=>!t.done&&t.due<=today());const attention=low.length+expiring.length+due.length;
const followUpOpen=s.tasks.filter(t=>!t.done);
const followUpOverdue=followUpOpen.filter(t=>t.due<today());
const followUpToday=followUpOpen.filter(t=>t.due===today());
const followUpUpcoming=followUpOpen.filter(t=>t.due>today()&&t.due<=shiftDate(7));
const followUpCompleted=s.tasks.filter(t=>t.done);
const followUpHigh=followUpOpen.filter(t=>t.priority==='High');
const followUpFocusText=followUpOverdue.length
  ? followUpOverdue.length+' overdue '+(followUpOverdue.length===1?'reminder needs':'reminders need')+' attention.'
  : followUpToday.length
    ? followUpToday.length+' '+(followUpToday.length===1?'reminder is':'reminders are')+' due today.'
    : followUpOpen.length
      ? 'Nothing overdue. Review the next customer conversations when you are ready.'
      : 'You are all caught up. New delivery follow-ups will appear here automatically.';
const followUpPriorityRank:Record<Task['priority'],number>={High:0,Normal:1,Low:2};
const followUpQuery=deferredQuery.trim().toLowerCase();
const followUpRows=calculate(()=>s.tasks.filter(t=>{
  const customer=customerById.get(t.customerId),order=orderById.get(t.orderId);
  const filterMatch=filter==='All'||filter==='Open'&&!t.done||filter==='Completed'&&t.done||filter==='Overdue'&&!t.done&&t.due<today()||filter==='Today'&&!t.done&&t.due===today()||filter==='Next 7 days'&&!t.done&&t.due>today()&&t.due<=shiftDate(7)||filter==='Follow-up'&&t.kind==='Follow-up'||filter==='Replenishment'&&t.kind==='Replenishment'||filter==='High priority'&&!t.done&&t.priority==='High';
  const searchMatch=!followUpQuery||[t.title,t.kind,t.priority,t.channel,t.notes,customer?.name,customer?.phone,order?.number].some(value=>String(value||'').toLowerCase().includes(followUpQuery));
  return filterMatch&&searchMatch;
}).sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due)||followUpPriorityRank[a.priority]-followUpPriorityRank[b.priority]||a.title.localeCompare(b.title)),[s.tasks,customerById,orderById,filter,followUpQuery]);
const inventoryUnits=activeProducts.reduce((n,p)=>n+stock(s,p.id),0);
const inventoryLow=activeProducts.filter(p=>{const qty=stock(s,p.id);return qty>0&&qty<=p.reorderAt});
const inventoryOut=activeProducts.filter(p=>stock(s,p.id)===0);
const inventoryExpiring=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry>today()&&b.expiry<=shiftDate(90));
const inventoryExpired=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry<=today());
const openPurchaseOrders=s.purchaseOrders.filter(po=>!['Received','Cancelled'].includes(po.status));
const currentInventoryMonth=today().slice(0,7);
const receivedThisMonth=s.batches.filter(b=>b.received.slice(0,7)===currentInventoryMonth);
const receivedUnitsThisMonth=receivedThisMonth.reduce((n,b)=>n+b.qty,0);
const inventoryVelocity=calculate(()=>{const delivered=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created)>=shiftDate(-29));return s.products.filter(p=>p.active).map(product=>({product,units:delivered.reduce((n,o)=>n+o.items.filter(i=>i.productId===product.id).reduce((x,i)=>x+i.qty,0),0)})).sort((a,b)=>b.units-a.units)},[s]);
const fastestMoving=inventoryVelocity.find(x=>x.units>0);
const slowMovingCount=inventoryVelocity.filter(x=>stock(s,x.product.id)>0&&x.units===0).length;
const inventoryPositions=calculate(()=>s.products.filter(p=>p.active).map(product=>({product,...stockPosition(s,product.id)})),[s]);
const inventoryPhysicalUnits=inventoryPositions.reduce((n,x)=>n+x.physical,0);
const inventoryReservedUnits=inventoryPositions.reduce((n,x)=>n+x.reserved,0);
const inventoryReturnPendingUnits=inventoryPositions.reduce((n,x)=>n+x.returnedPending,0);
const inventoryBlockedUnits=inventoryPositions.reduce((n,x)=>n+x.blocked,0);
const activeInventoryHolds=s.inventoryHolds.filter(h=>!h.releasedAt);
const pendingReturnOrders=s.orders.filter(o=>o.status==='Returned'&&!o.restocked);
const cancelledInspectionHolds=activeInventoryHolds.filter(h=>h.source==='Cancelled'&&h.type==='Quarantine');
const cancelledInspectionOrderIds=[...new Set(cancelledInspectionHolds.map(h=>h.sourceOrderId).filter((id):id is string=>Boolean(id)))];
const cancelledInspectionGroups=cancelledInspectionOrderIds.map(orderId=>({order:s.orders.find(o=>o.id===orderId),holds:cancelledInspectionHolds.filter(h=>h.sourceOrderId===orderId)}));
const managedInventoryHolds=activeInventoryHolds.filter(h=>!(h.source==='Cancelled'&&h.type==='Quarantine'));
const externalFlow=flow.entries.filter(e=>e.source!=='Transfer'),allCashIn=externalFlow.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0),allCashOut=externalFlow.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0),netCashMovement=allCashIn-allCashOut;
const overduePayables=s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&b.dueDate&&b.dueDate<today()?balance:0)},0);
const reconciledAccounts=s.accountOpenings.length,unassignedMovements=flow.entries.filter(e=>!s.accountMatches.some(m=>m.entryId===e.id)).length;
const integrityIssues:{level:'Critical'|'Warning';title:string;detail:string;tab:string}[]=[];
const integrityBalances=accountIds.map(account=>({account,name:accountNames[account],balance:accountBalance(s,account)}));
integrityBalances.forEach(a=>{if(a.balance!==null&&a.balance<-.001)integrityIssues.push({level:'Warning',title:a.name+' has a negative CRM balance',detail:taka(a.balance)+' · check opening balance or missing transactions.',tab:'Reconciliation'})});
if(unassignedMovements)integrityIssues.push({level:'Warning',title:unassignedMovements+' cash movements are not assigned to an account',detail:'Assign Cash, Bank, bKash or Nagad in Accounts & reconciliation.',tab:'Reconciliation'});
const flowIds=new Set(flow.entries.map(e=>e.id));s.accountMatches.filter(m=>!flowIds.has(m.entryId)).forEach(m=>integrityIssues.push({level:'Warning',title:'Orphan account assignment',detail:m.entryId+' no longer matches a cashflow movement.',tab:'Reconciliation'}));
const transferIds=Array.from(new Set(s.cashEntries.map(e=>e.transferId).filter((id):id is string=>Boolean(id))));transferIds.forEach(id=>{const list=s.cashEntries.filter(e=>e.transferId===id);if(list.length!==2||list[0]?.amount!==list[1]?.amount||list[0]?.kind===list[1]?.kind)integrityIssues.push({level:'Critical',title:'Broken account transfer',detail:'Transfer '+id+' does not have one equal cash-in and cash-out pair.',tab:'Cashflow'})});
s.cashEntries.filter(e=>e.reversalOf&&!s.cashEntries.some(x=>x.id===e.reversalOf)).forEach(e=>integrityIssues.push({level:'Warning',title:'Reversal source is missing',detail:e.description,tab:'Cashflow'}));
const periodReport=financialPeriod(s,reportMonth);
const reportOrders=s.orders.filter(o=>(o.status==='Delivered'||!!o.delivered)&&(o.delivered||o.created).slice(0,7)===reportMonth),reportExpenses=s.expenses.filter(e=>e.date.slice(0,7)===reportMonth),reportRevenue=periodReport.revenue,reportDeliveryIncome=periodReport.delivery,reportCogs=periodReport.cogs,reportGross=reportRevenue-reportCogs,reportFulfillment=periodReport.fulfillment,reportReturns=periodReport.returnCosts,reportOpex=periodReport.expenses,reportProfit=periodReport.profit,reportMargin=reportRevenue>0?reportProfit/reportRevenue*100:0;
const previousMonth=(()=>{const [y,m]=reportMonth.split('-').map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7)})(),previousOrders=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)===previousMonth),previousRevenue=financialPeriod(s,previousMonth).revenue;
const reportCustomerIds=Array.from(new Set(reportOrders.map(o=>o.customerId))),reportAov=reportOrders.length?reportRevenue/reportOrders.length:0;
const reportNewCustomers=s.customers.filter(customer=>customer.created.slice(0,7)===reportMonth).length;
const reportRepeatCustomers=reportCustomerIds.filter(customerId=>s.orders.some(o=>o.customerId===customerId&&o.status==='Delivered'&&(o.delivered||o.created)<reportMonth+'-01')).length;
const reportRepeatRate=reportCustomerIds.length?reportRepeatCustomers/reportCustomerIds.length*100:0;
const reportReturnedOrders=s.orders.filter(o=>o.status==='Returned'&&(o.returnedAt||o.delivered||o.created).slice(0,7)===reportMonth);
const reportReturnRate=(reportOrders.length+reportReturnedOrders.length)?reportReturnedOrders.length/(reportOrders.length+reportReturnedOrders.length)*100:0;
const salesBreakdown=periodSalesBreakdown(s,reportMonth);
const reportChannelRows=salesBreakdown.channels.sort((a,b)=>b.revenue-a.revenue);
const reportProductRows=salesBreakdown.products.map(row=>({product:productById.get(row.productId)!,units:row.units,revenue:row.revenue})).filter(row=>row.product&&(row.units!==0||row.revenue!==0)).sort((a,b)=>b.revenue-a.revenue||b.units-a.units).slice(0,6);
const reportProductMax=Math.max(1,...reportProductRows.map(row=>row.revenue));
const reportRevenueDelta=previousRevenue?Math.round((reportRevenue-previousRevenue)/previousRevenue*100):null;
const reportPulse=reportProfit<0?'Needs attention':reportReturnRate>12?'Watch returns':reportRepeatRate>=35?'Healthy retention':'Building momentum';
const reportPulseTone=reportProfit<0||reportReturnRate>12?'warning':reportRepeatRate>=35?'positive':'neutral';
const reportTopChannel=reportChannelRows[0]??null,reportTopProduct=reportProductRows[0]??null,reportWorkingCapital=m.pending-m.unpaidStock;
const reportInsightTone={
  revenue:reportRevenueDelta===null?'neutral':reportRevenueDelta>=0?'positive':'warning',
  retention:reportRepeatRate>=35?'positive':reportRepeatRate>=20?'neutral':'warning',
  operations:reportReturnRate>12||inventoryOut.length>0?'warning':'positive'
};
const reportPurchaseOrders=s.purchaseOrders.filter(po=>po.created.slice(0,7)===reportMonth&&po.status!=='Cancelled'),reportPurchasingValue=reportPurchaseOrders.reduce((n,po)=>n+purchaseOrderValue(po),0);
const reportProductProfitability=s.products.map(product=>{let units=0,revenue=0,cost=0;for(const order of reportOrders)for(const item of order.items.filter(i=>i.productId===product.id)){units+=item.qty;revenue+=item.qty*item.price;cost+=item.allocations.reduce((n,a)=>n+a.qty*a.unitCost,0)}const gross=revenue-cost;return {product,units,revenue,cost,gross,margin:revenue?gross/revenue*100:0}}).filter(row=>row.units>0).sort((a,b)=>b.gross-a.gross||b.revenue-a.revenue).slice(0,8);
const reportCustomerValue=s.customers.map(customer=>{const delivered=s.orders.filter(o=>o.customerId===customer.id&&o.status==='Delivered'),revenue=delivered.reduce((n,o)=>n+subtotal(o),0),last=delivered.map(o=>o.delivered||o.created).sort().at(-1)||'';return {customer,orders:delivered.length,revenue,aov:delivered.length?revenue/delivered.length:0,last}}).filter(row=>row.orders>0).sort((a,b)=>b.revenue-a.revenue||b.orders-a.orders).slice(0,6);
const inventoryAgeingLabels=['0–30 days','31–60 days','61–90 days','90+ days'] as const;
const inventoryAgeDays=(date:string)=>Math.max(0,Math.floor((Date.parse(today()+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000));
const inventoryAgeing=inventoryAgeingLabels.map(label=>{let units=0,value=0;for(const batch of s.batches){const remaining=batchRemaining(s,batch);if(remaining<=0)continue;const days=inventoryAgeDays(batch.received),bucket=days<=30?'0–30 days':days<=60?'31–60 days':days<=90?'61–90 days':'90+ days';if(bucket!==label)continue;units+=remaining;value+=remaining*batch.unitCost}return {label,units,value}});
const inventoryAgeingTotal=inventoryAgeing.reduce((n,row)=>n+row.value,0);
const supplierPerformance=s.suppliers.map(supplier=>{const insight=supplierInsight(s,supplier.id),pos=insight.purchaseOrders.filter(po=>po.status!=='Cancelled'),received=pos.filter(po=>po.status==='Received'),open=pos.filter(po=>!['Received','Cancelled'].includes(po.status)),overdue=insight.overduePurchaseOrders,value=pos.reduce((n,po)=>n+purchaseOrderValue(po),0);return {supplier,orders:pos.length,received:received.length,open:open.length,overdue:overdue.length,value,avgLead:insight.avgLeadDays}}).filter(row=>row.orders>0).sort((a,b)=>b.value-a.value||b.orders-a.orders).slice(0,6);
const reportCollected=reportOrders.reduce((n,o)=>n+Math.min(receivable(o),o.collections.reduce((x,p)=>x+p.amount,0)+(o.settled&&o.collections.length===0?receivable(o):0)),0);
const reportCollectionRate=reportOrders.reduce((n,o)=>n+receivable(o),0)?reportCollected/reportOrders.reduce((n,o)=>n+receivable(o),0)*100:0;
const reportMonths=financialMonths(s);
const closeEnd=closeMonth+'-31',closeMovements=flow.entries.filter(e=>e.date.slice(0,7)===closeMonth),closeUnassigned=closeMovements.filter(e=>!s.accountMatches.some(m=>m.entryId===e.id)).length,closeMissingAccounts=4-s.accountOpenings.length,closeReceivables=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)<=closeMonth).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0;return n+Math.max(0,due-o.collections.filter(p=>p.date<=closeEnd).reduce((x,p)=>x+p.amount,0)-legacy)},0),closePayables=s.batches.filter(b=>b.received.slice(0,7)<=closeMonth).reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0;return n+Math.max(0,amount-b.payments.filter(p=>p.date<=closeEnd).reduce((x,p)=>x+p.amount,0)-legacy)},0),closeRecord=s.financeCloses.find(x=>x.month===closeMonth),closeBlockers=closeUnassigned+closeMissingAccounts+flow.undated;

const ageDays=(date:string)=>Math.max(0,Math.floor((Date.parse(today()+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000));const ageBucket=(days:number)=>days<=7?'0–7 days':days<=30?'8–30 days':days<=60?'31–60 days':'60+ days';const agingLabels=['0–7 days','8–30 days','31–60 days','60+ days'] as const;
const receivableAging=agingLabels.map(label=>({label,amount:s.orders.filter(isCollectible).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0,balance=Math.max(0,due-o.collections.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&ageBucket(ageDays(o.delivered||o.created))===label?balance:0)},0)}));
const payableAging=agingLabels.map(label=>({label,amount:s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy),age=b.dueDate?ageDays(b.dueDate):ageDays(b.received);return n+(balance>.001&&ageBucket(age)===label?balance:0)},0)}));
const configuredBalances=accountIds.map(account=>({account,name:accountNames[account],balance:accountBalance(s,account)})),availableCash=configuredBalances.reduce((n,a)=>n+(a.balance??0),0);
const forecastReceivables=s.orders.filter(isCollectible).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0;return n+Math.max(0,due-o.collections.reduce((x,p)=>x+p.amount,0)-legacy)},0);
const forecastPayables30=s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&b.dueDate&&b.dueDate<=shiftDate(30)?balance:0)},0);
const recent30=externalFlow.filter(e=>e.date>=shiftDate(-29)),recentCashIn=recent30.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0),recentCashOut=recent30.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0),recentNet=recentCashIn-recentCashOut;
const projected30=availableCash+forecastReceivables-forecastPayables30-customerRefundPayable(s)+recentNet;
const monthlyTrend=Array.from({length:6},(_,idx)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-(5-idx));const month=d.toISOString().slice(0,7),p=financialPeriod(s,month),revenue=p.revenue,profit=p.profit,cash=externalFlow.filter(e=>e.date.slice(0,7)===month).reduce((n,e)=>n+(e.kind==='in'?e.amount:-e.amount),0);return {month,label:new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short'}),revenue,profit,cash}}),trendMax=Math.max(1,...monthlyTrend.flatMap(x=>[Math.abs(x.revenue),Math.abs(x.profit),Math.abs(x.cash)]));


const automationLive=calculate(()=>automationSignals(s),[s]);
const automationActiveRules=Object.values(s.automationSettings).filter(rule=>rule.enabled).length;
const automationCritical=automationLive.filter(signal=>signal.level==='Critical').length;
const automationAction=automationLive.filter(signal=>signal.level==='Action needed').length;
const automationUpcoming=automationLive.filter(signal=>signal.level==='Upcoming').length;
const autoAlerts:AutoAlert[]=automationLive.map(signal=>({id:signal.key,level:signal.level,title:signal.title,detail:signal.detail,view:signal.view,role:signal.role}));
s.tasks.filter(t=>!t.done&&t.due<=shiftDate(2)).forEach(t=>autoAlerts.push({id:'task-'+t.id,level:t.due<today()||t.priority==='High'?'Critical':'Upcoming',title:t.title,detail:t.priority+' priority · '+(t.due<today()?'overdue · ':'due ')+dateLabel(t.due),view:'Follow-ups',role:'sales'}));
if(unassignedMovements)autoAlerts.push({id:'reconcile',level:unassignedMovements>5?'Critical':'Action needed',title:'Reconcile '+unassignedMovements+' cash movements',detail:'Assign recorded movements to Cash, Bank, bKash or Nagad.',view:'Finances',role:'finance'});
if(projected30<0)autoAlerts.push({id:'liquidity',level:'Critical',title:'Negative 30-day planning position',detail:'Projected shortfall '+taka(Math.abs(projected30))+' based on current CRM assumptions.',view:'Finances',role:'finance'});
const alertRank:Record<AutoAlert['level'],number>={Critical:0,'Action needed':1,Upcoming:2};const roleAlerts=autoAlerts.filter(a=>role==='owner'||role==='admin'||role==='viewer'||a.role==='all'||(role==='sales'&&a.role==='sales')||(role==='inventory'&&a.role==='inventory')||(role==='finance'&&a.role==='finance')).sort((a,b)=>alertRank[a.level]-alertRank[b.level]);
const alertCritical=roleAlerts.filter(a=>a.level==='Critical').length,alertAction=roleAlerts.filter(a=>a.level==='Action needed').length,alertUpcoming=roleAlerts.filter(a=>a.level==='Upcoming').length;
const shownAlerts=alertFilter==='All'?roleAlerts:roleAlerts.filter(a=>a.level===alertFilter);
const alertFocus=roleAlerts[0];
const alertActionLabel=(alert:AutoAlert)=>alert.view==='Follow-ups'?'Open follow-ups':alert.view==='Finances'?'Open finance':alert.view==='Inventory'?'Open inventory':alert.view==='Suppliers'?'Open purchasing':alert.view==='Orders'?'Open orders':'Open '+alert.view.toLowerCase();
const managementActionQueue=[
  ...(inventoryOut.length?[{id:'stockout',level:'Critical' as const,title:inventoryOut.length+' active '+(inventoryOut.length===1?'product is':'products are')+' out of stock',detail:'Restore availability before demand is lost.',view:'Inventory' as View}]:[]),
  ...(inventoryLow.length?[{id:'lowstock',level:'Action needed' as const,title:inventoryLow.length+' '+(inventoryLow.length===1?'product is':'products are')+' below reorder level',detail:'Review replenishment and open purchase orders.',view:'Inventory' as View}]:[]),
  ...(followUpOverdue.length?[{id:'followups',level:'Action needed' as const,title:followUpOverdue.length+' customer '+(followUpOverdue.length===1?'follow-up is':'follow-ups are')+' overdue',detail:'Protect retention by clearing overdue conversations.',view:'Follow-ups' as View}]:[]),
  ...(overduePayables>0?[{id:'payables',level:'Action needed' as const,title:'Supplier payments overdue',detail:taka(overduePayables)+' is past due.',view:'Finances' as View}]:[]),
  ...(projected30<0?[{id:'cash',level:'Critical' as const,title:'30-day cash position is negative',detail:'Projected gap '+taka(Math.abs(projected30))+'.',view:'Finances' as View}]:[]),
  ...(reportReturnRate>12?[{id:'returns',level:'Action needed' as const,title:'Return rate is elevated',detail:reportReturnRate.toFixed(1)+'% for the selected reporting month.',view:'Orders' as View}]:[]),
  ...(integrityIssues.length?[{id:'integrity',level:'Action needed' as const,title:integrityIssues.length+' control '+(integrityIssues.length===1?'issue needs':'issues need')+' review',detail:'Open Finance → Reconciliation and resolve data-control warnings.',view:'Finances' as View}]:[])
].slice(0,7);
const managementControlScore=Math.max(0,100-Math.min(100,integrityIssues.length*12+unassignedMovements*4+inventoryExpired.length*5+(projected30<0?18:0)));
const todayOrders=s.orders.filter(o=>o.created===today()),todayOrderValue=todayOrders.reduce((n,o)=>n+total(o),0),readyToPackOrders=s.orders.filter(o=>o.status==='Ready to pack').length,outForDeliveryOrders=s.orders.filter(o=>o.status==='Out for delivery').length,openOrderCount=s.orders.filter(o=>!['Delivered','Returned','Cancelled'].includes(o.status)).length,pendingCollectionOrders=s.orders.filter(o=>isCollectible(o)&&orderBalance(o)>.001).length,outstandingOrderValue=s.orders.reduce((n,o)=>n+orderBalance(o),0),returnRate=m.delivered?Math.round(s.orders.filter(o=>o.status==='Returned').length/(m.delivered+s.orders.filter(o=>o.status==='Returned').length)*100):0;
const chart=Array.from({length:Number(range)},(_,i)=>{const date=shiftDate(i-Number(range)+1);return {date:dateLabel(date),sales:s.orders.filter(o=>o.status==='Delivered'&&o.delivered===date).reduce((n,o)=>n+subtotal(o),0)}});const periodSales=chart.reduce((n,d)=>n+d.sales,0);
return {metrics:m,overview:{todayOrderCount:todayOrders.length,todayOrderValue,openOrderCount,readyToPackOrders,outForDeliveryOrders,pendingCollections:m.pending,pendingCollectionOrders,inventoryOutCount:inventoryOut.length,inventoryLowCount:inventoryLow.length,attention,purchasingOverdueCount:s.purchaseOrders.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today()).length,followUpOverdueCount:followUpOverdue.length,followUpTodayCount:followUpToday.length,followUpOpenCount:followUpOpen.length,purchasingIncomingUnits:openPurchaseOrders.reduce((n,po)=>n+purchaseOrderOutstandingUnits(po),0),chart,periodSales,profit:m.profit,inventoryUnits,customerCount:s.customers.length,unpaidStock:m.unpaidStock,alertCritical,alertAction,alertUpcoming},report:{reportMonth,
reportPulseTone,
reportPulse,
reportOrders:{length:reportOrders.length},
reportMonths,
reportRevenue,
reportRevenueDelta,
reportProfit,
reportMargin,
reportAov,
reportRepeatRate,
reportRepeatCustomers,
reportCustomerIds:{length:reportCustomerIds.length},
reportReturnRate,
reportReturnedOrders:{length:reportReturnedOrders.length},
reportNewCustomers,
reportInsightTone,
inventoryOut:{length:inventoryOut.length},
inventoryLow:{length:inventoryLow.length},
monthlyTrend,
reportWorkingCapital,
reportChannelRows,
reportTopChannel,
reportProductRows,
reportProductMax,
m,
reportPurchaseOrders:{length:reportPurchaseOrders.length},
reportPurchasingValue,
reportTopProduct,
reportProductProfitability,
reportCustomerValue,
inventoryAgeing,
inventoryAgeingTotal,
supplierPerformance,
managementActionQueue,
managementControlScore,
integrityIssues,
unassignedMovements,
automationActiveRules,
inventoryExpired:{length:inventoryExpired.length},
projected30,
reportCollectionRate,
role},orderStats:{openOrderCount,readyToPackOrders,outForDeliveryOrders,outstandingOrderValue,todayOrderCount:todayOrders.length,todayOrderValue,deliveredCount:m.delivered,returnRate,total:s.orders.length,statusCounts:Object.fromEntries(statuses.map(status=>[status,s.orders.filter(o=>o.status===status).length]))},roleAlerts:roleAlerts.slice(0,100),alertCounts:{critical:alertCritical,action:alertAction,upcoming:alertUpcoming}};
}
export type WorkspaceSummary=ReturnType<typeof workspaceSummary>;
