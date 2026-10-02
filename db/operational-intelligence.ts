import { database } from './raw.ts';
import { getCutoverState } from './relational-cutover.ts';
import { relationalCoreState } from './relational-cutover.ts';
import { accountBalance,accountIds,automationSignals,batchRemaining,cashflow,contribution,orderBalance,shiftDate,stock,subtotal,today,total,type State } from '../lib/crm.ts';

const round=(n:number)=>Math.round(n*100)/100;
const daysBetween=(from:string,to:string)=>Math.max(0,Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000));
const addDays=(date:string,days:number)=>shiftDate(days,date);
const deliveredDate=(order:State['orders'][number])=>order.delivered||order.created;
const isDelivered=(order:State['orders'][number])=>order.status==='Delivered';
const isOpenOrder=(order:State['orders'][number])=>!['Delivered','Returned','Cancelled'].includes(order.status);

function payables(state:State){
  return round(state.batches.reduce((sum,batch)=>{
    const amount=batch.qty*batch.unitCost;
    const legacy=batch.paid&&batch.payments.length===0?amount:0;
    const paid=legacy+batch.payments.reduce((n,p)=>n+p.amount,0);
    return sum+Math.max(0,amount-paid);
  },0));
}

function rangeMetrics(state:State,from:string,to:string){
  const delivered=state.orders.filter(order=>isDelivered(order)&&deliveredDate(order)>=from&&deliveredDate(order)<=to);
  const revenue=round(delivered.reduce((n,o)=>n+subtotal(o),0));
  const operatingContribution=round(delivered.reduce((n,o)=>n+contribution(o),0));
  const expenses=round(state.expenses.filter(e=>e.date>=from&&e.date<=to).reduce((n,e)=>n+e.amount,0));
  const profit=round(operatingContribution-expenses);
  const customers=new Set(delivered.map(o=>o.customerId));
  const repeat=[...customers].filter(customerId=>state.orders.filter(o=>o.customerId===customerId&&isDelivered(o)&&deliveredDate(o)<=to).length>1).length;
  const returns=state.orders.filter(o=>o.status==='Returned'&&(o.returnedAt||o.delivered||o.created)>=from&&(o.returnedAt||o.delivered||o.created)<=to).length;
  return {
    from,to,orders:delivered.length,revenue,profit,
    margin:revenue?round(profit/revenue*100):0,
    averageOrder:delivered.length?round(delivered.reduce((n,o)=>n+total(o),0)/delivered.length):0,
    customers:customers.size,
    repeatRate:customers.size?round(repeat/customers.size*100):0,
    returnRate:delivered.length?round(returns/delivered.length*100):0
  };
}

function customerRetention(state:State){
  const rows=state.customers.map(customer=>{
    const orders=state.orders.filter(o=>o.customerId===customer.id&&isDelivered(o)).sort((a,b)=>deliveredDate(a).localeCompare(deliveredDate(b)));
    if(!orders.length)return null;
    const dates=orders.map(deliveredDate);
    const gaps=dates.slice(1).map((date,index)=>daysBetween(dates[index],date));
    const avgGap=gaps.length?Math.max(14,Math.min(180,Math.round(gaps.reduce((n,v)=>n+v,0)/gaps.length))):60;
    const last=dates[dates.length-1],predicted=addDays(last,avgGap),daysTo=daysBetween(today(),predicted)*(predicted<today()?-1:1);
    const revenue=round(orders.reduce((n,o)=>n+subtotal(o),0));
    const activeOrder=state.orders.some(o=>o.customerId===customer.id&&isOpenOrder(o));
    const openTask=state.tasks.some(t=>t.customerId===customer.id&&!t.done);
    const status=predicted<today()?'overdue':predicted<=shiftDate(14)?'due-soon':'future';
    return {customerId:customer.id,name:customer.name,orders:orders.length,revenue,lastPurchase:last,averageGapDays:avgGap,predictedNextPurchase:predicted,daysTo,activeOrder,openTask,status};
  }).filter((row):row is NonNullable<typeof row>=>Boolean(row));
  rows.sort((a,b)=>a.predictedNextPurchase.localeCompare(b.predictedNextPurchase)||b.revenue-a.revenue);
  return rows.slice(0,50);
}

function replenishment(state:State){
  const since=shiftDate(-59);
  return state.products.filter(p=>p.active).map(product=>{
    const units=state.orders.filter(o=>isDelivered(o)&&deliveredDate(o)>=since).reduce((sum,o)=>sum+o.items.filter(i=>i.productId===product.id).reduce((n,i)=>n+i.qty,0),0);
    const daily=units/60;
    const available=stock(state,product.id);
    const coverDays=daily>0?Math.round(available/daily):null;
    const suggested=Math.max(0,product.targetQty-available);
    const risk=available===0?'stock-out':available<=product.reorderAt?'reorder-now':coverDays!==null&&coverDays<=21?'watch':'healthy';
    return {productId:product.id,name:product.brand+' '+product.name,available,units60d:units,dailyVelocity:round(daily),coverDays,suggestedReorderQty:suggested,risk};
  }).sort((a,b)=>{
    const rank:Record<string,number>={'stock-out':0,'reorder-now':1,watch:2,healthy:3};
    return rank[a.risk]-rank[b.risk]||(a.coverDays??9999)-(b.coverDays??9999);
  });
}

function controls(state:State){
  const flow=cashflow(state);
  const flowIds=new Set(flow.entries.map(e=>e.id));
  const orphanAssignments=state.accountMatches.filter(match=>!flowIds.has(match.entryId)).length;
  const unassigned=flow.entries.filter(entry=>!state.accountMatches.some(match=>match.entryId===entry.id)).length;
  const negativeAccounts=accountIds.map(account=>({account,balance:accountBalance(state,account)})).filter(x=>x.balance!==null&&x.balance<-.001);
  const duplicateOrderNumbers=state.orders.length-new Set(state.orders.map(o=>o.number.trim().toLowerCase())).size;
  const brokenTransfers=[...new Set(state.cashEntries.map(e=>e.transferId).filter(Boolean))].filter(id=>{
    const entries=state.cashEntries.filter(e=>e.transferId===id);
    return entries.length!==2||entries[0]?.amount!==entries[1]?.amount||entries[0]?.kind===entries[1]?.kind;
  }).length;
  return {orphanAssignments,unassigned,negativeAccounts,duplicateOrderNumbers,brokenTransfers};
}

export async function buildOperationalIntelligence(ownerId:string){
  const started=Date.now();
  const {state,version}=await relationalCoreState(ownerId);
  const currentEnd=today(),currentStart=shiftDate(-29),previousEnd=shiftDate(-30),previousStart=shiftDate(-59);
  const current=rangeMetrics(state,currentStart,currentEnd),previous=rangeMetrics(state,previousStart,previousEnd);
  const revenueDelta=previous.revenue?round((current.revenue-previous.revenue)/previous.revenue*100):null;
  const profitDelta=previous.profit?round((current.profit-previous.profit)/Math.abs(previous.profit)*100):null;
  const retention=customerRetention(state);
  const products=replenishment(state);
  const automation=automationSignals(state);
  const audit=await database().prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE owner_id=? ORDER BY created_at DESC LIMIT 20').bind(ownerId).all<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>();
  const domainVersions=await database().prepare('SELECT domain,version,updated_at FROM crm_domain_versions WHERE owner_id=? ORDER BY domain').bind(ownerId).all<{domain:string;version:number;updated_at:string}>();
  const cutover=await getCutoverState(ownerId);
  const control=controls(state);
  const lowStock=state.products.filter(p=>p.active&&stock(state,p.id)<=p.reorderAt);
  const outOfStock=state.products.filter(p=>p.active&&stock(state,p.id)===0);
  const overduePurchaseOrders=state.purchaseOrders.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today());
  const receivables=round(state.orders.reduce((n,o)=>n+orderBalance(o),0));
  const payable=payables(state);
  const dueTasks=state.tasks.filter(t=>!t.done&&t.due<=today()).length;
  const openOrders=state.orders.filter(isOpenOrder).length;
  const activeRules=Object.values(state.automationSettings).filter(rule=>rule.enabled).length;
  const criticalSignals=automation.filter(signal=>signal.level==='Critical').length;
  const actionSignals=automation.filter(signal=>signal.level==='Action needed').length;
  const upcomingSignals=automation.filter(signal=>signal.level==='Upcoming').length;
  const entityCount=state.products.length+state.customers.length+state.suppliers.length+state.purchaseOrders.length+state.batches.length+state.orders.length+state.expenses.length+state.cashEntries.length+state.tasks.length;
  const approximateBytes=Buffer.byteLength(JSON.stringify(state),'utf8');
  const pressure=entityCount>30000||approximateBytes>4_000_000?'high':entityCount>15000||approximateBytes>2_000_000?'medium':'normal';
  const controlIssues=control.orphanAssignments+control.unassigned+control.negativeAccounts.length+control.duplicateOrderNumbers+control.brokenTransfers;
  const hardeningChecks=[
    {key:'relational-cutover',ok:Boolean(cutover.enabled),detail:cutover.enabled?'Relational core is authoritative.':'Relational cutover is not enabled.'},
    {key:'last-parity',ok:Boolean((cutover.lastVerification as any)?.ok),detail:(cutover.lastVerification as any)?.ok?'Last relational parity verification passed.':'Last relational parity verification is missing or failed.'},
    {key:'control-integrity',ok:controlIssues===0,detail:controlIssues===0?'No management-control integrity issues detected.':controlIssues+' management-control issue(s) need review.'},
    {key:'scale-pressure',ok:pressure!=='high',detail:'Dataset pressure is '+pressure+'.'}
  ];
  return {
    generatedAt:new Date().toISOString(),
    source:{architecture:'relational-core',workspaceVersion:version,domainVersions:domainVersions.results,cutover},
    managementReports:{windowDays:30,current,previous,revenueDelta,profitDelta},
    retention:{queue:retention,overdue:retention.filter(x=>x.status==='overdue').length,dueSoon:retention.filter(x=>x.status==='due-soon').length},
    replenishment:{products,stockOuts:products.filter(x=>x.risk==='stock-out').length,reorderNow:products.filter(x=>x.risk==='reorder-now').length,watch:products.filter(x=>x.risk==='watch').length},
    automation:{activeRules,totalRules:Object.keys(state.automationSettings).length,critical:criticalSignals,actionNeeded:actionSignals,upcoming:upcomingSignals,signals:automation.slice(0,50)},
    dashboard:{openOrders,lowStock:lowStock.length,outOfStock:outOfStock.length,overduePurchaseOrders:overduePurchaseOrders.length,receivables,payables:payable,dueTasks},
    auditControl:{controls:control,recent:audit.results.map(row=>({...row,sections:JSON.parse(row.sections||'[]')})),issueCount:controlIssues},
    performance:{entityCount,approximateBytes,pressure,calculationMs:Date.now()-started,counts:{products:state.products.length,customers:state.customers.length,orders:state.orders.length,batches:state.batches.length,purchaseOrders:state.purchaseOrders.length,cashEntries:state.cashEntries.length}},
    hardening:{checks:hardeningChecks,ok:hardeningChecks.every(check=>check.ok)}
  };
}
