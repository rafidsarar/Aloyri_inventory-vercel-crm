import { costOfOrder,customerPaidAmount,refundedAmount,returnInventoryCost,subtotal,type State } from './crm.ts';
const inMonth=(date:string|undefined,month:string)=>!!date&&date.slice(0,7)===month;
export function retainedReturnIncome(s:State){return s.returnSettlements.reduce((n,r)=>{const o=s.orders.find(o=>o.id===r.orderId);if(!o)return n;return n+Math.max(0,customerPaidAmount(o)-(r.kind==='Refund'?r.amount:refundedAmount(s,o)+r.amount));},0);}
/** Dated delivery, return and inspection events keep later returns out of earlier periods. */
export function financialPeriod(s:State,month:string){
 let productSales=0,deliveryIncome=0,cogs=0,fulfillment=0,returnSales=0,returnDelivery=0,recoveredCost=0,failedDelivery=0,retainedIncome=0;
 for(const o of s.orders){
  const sold=!!o.delivered||o.status==='Delivered',delivered=o.delivered||o.created;
  if(sold&&inMonth(delivered,month)){productSales+=subtotal(o);deliveryIncome+=o.deliveryCharge;cogs+=costOfOrder(o);fulfillment+=o.courierCost+o.packaging+o.paymentFee;}
  if(o.status!=='Returned')continue;
  const returned=o.returnedAt||o.delivered||o.created;
  if(inMonth(returned,month)){if(sold){returnSales+=subtotal(o);returnDelivery+=o.deliveryCharge;}else{cogs+=costOfOrder(o);failedDelivery+=o.courierCost+o.packaging+o.paymentFee;}failedDelivery+=o.returnFee;}
  if(o.restocked){const inspection=s.returnInspections.find(i=>i.orderId===o.id&&!i.event);const inspectionDate=inspection?.date||returned;if(inMonth(inspectionDate,month))recoveredCost+=inspection?(inspection.outcome==='Damaged'?0:costOfOrder(o)):Math.max(0,costOfOrder(o)-returnInventoryCost(s,o)-s.returnInspections.filter(i=>i.orderId===o.id&&i.event).reduce((n,i)=>n+(i.event==='Recovered'?1:-1)*(i.amount||0),0));}
 }
 for(const e of s.returnInspections)if(e.event&&inMonth(e.date,month))recoveredCost+=(e.event==='Recovered'?1:-1)*(e.amount||0);
 for(const r of s.returnSettlements){const o=s.orders.find(o=>o.id===r.orderId);if(o&&inMonth(r.date,month))retainedIncome+=Math.max(0,customerPaidAmount(o)-(r.kind==='Refund'?r.amount:refundedAmount(s,o)+r.amount));}
 const expenses=s.expenses.filter(e=>inMonth(e.date,month)).reduce((n,e)=>n+e.amount,0),revenue=productSales-returnSales,delivery=deliveryIncome-returnDelivery,netCogs=cogs-recoveredCost;
 return {productSales,returnSales,deliveryIncome,returnDelivery,recoveredCost,cogs:netCogs,fulfillment,returnCosts:failedDelivery,retainedIncome,expenses,revenue,delivery,profit:revenue+delivery-netCogs-fulfillment-failedDelivery-expenses+retainedIncome};
}
