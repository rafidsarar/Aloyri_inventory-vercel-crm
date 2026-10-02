import {
  batchRemaining,
  cashflow,
  collectedAmount,
  orderBalance,
  receivable,
  shiftDate,
  stockPosition,
  today,
  validateRelations,
  workspaceIntegrityWarnings,
  type State
} from './crm.ts';

export type BusinessDataIssue={
  code:string;
  severity:'critical'|'warning'|'attention';
  count:number;
};

export type BusinessDataValidationReport={
  structuralValid:boolean;
  issueCount:number;
  criticalCount:number;
  warningCount:number;
  attentionCount:number;
  issues:BusinessDataIssue[];
};

const norm=(v:string)=>v.trim().toLowerCase().replace(/\s+/g,' ');
const phoneNorm=(v:string)=>v.replace(/\D/g,'');
const push=(issues:BusinessDataIssue[],code:string,severity:BusinessDataIssue['severity'],count:number)=>{
  if(count>0)issues.push({code,severity,count});
};
const dupCount=(values:string[])=>{
  const m=new Map<string,number>();
  for(const value of values){if(!value)continue;m.set(value,(m.get(value)||0)+1)}
  return [...m.values()].filter(n=>n>1).reduce((n,count)=>n+count,0);
};

export function validateBusinessData(state:State):BusinessDataValidationReport{
  const issues:BusinessDataIssue[]=[];
  let structuralValid=true;
  try{validateRelations(state,{skipOrderNumberUniqueness:true})}catch{structuralValid=false}
  push(issues,'structural-relations-invalid','critical',structuralValid?0:1);

  push(issues,'duplicate-order-numbers','critical',dupCount(state.orders.map(o=>norm(o.number))));
  push(issues,'duplicate-purchase-order-numbers','critical',dupCount(state.purchaseOrders.map(o=>norm(o.number))));
  push(issues,'duplicate-product-identities','warning',dupCount(state.products.map(p=>norm([p.brand,p.name,p.size].join('|')))));
  push(issues,'duplicate-customer-phones','warning',dupCount(state.customers.map(c=>phoneNorm(c.phone))));
  push(issues,'duplicate-supplier-names','warning',dupCount(state.suppliers.map(s=>norm(s.name))));

  push(issues,'negative-or-overallocated-batches','critical',state.batches.filter(b=>batchRemaining(state,b)<0).length);
  push(issues,'expired-stock-on-hand','attention',state.batches.filter(b=>b.expiry<=today()&&stockPosition(state,b.productId).expired>0).length);
  push(issues,'low-stock-products','attention',state.products.filter(p=>p.active&&stockPosition(state,p.id).available<=p.reorderAt).length);
  push(issues,'unlinked-stock-suppliers','warning',state.batches.filter(b=>!b.supplierId).length);

  const staleCutoff=shiftDate(-state.automationSettings.staleOrders.daysOpen);
  push(issues,'stale-open-orders','attention',state.orders.filter(o=>!['Delivered','Returned','Cancelled'].includes(o.status)&&o.created<staleCutoff).length);
  push(issues,'delivered-orders-with-balance','attention',state.orders.filter(o=>o.status==='Delivered'&&orderBalance(o)>.001).length);
  push(issues,'orders-marked-settled-below-receivable','critical',state.orders.filter(o=>o.settled&&o.collections.length>0&&collectedAmount(o)<receivable(o)-.001).length);

  push(issues,'overdue-purchase-orders','attention',state.purchaseOrders.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today()).length);
  push(issues,'purchase-orders-status-quantity-mismatch','critical',state.purchaseOrders.filter(po=>{
    const ordered=po.items.reduce((n,i)=>n+i.qty,0);
    const received=po.items.reduce((n,i)=>n+i.receivedQty,0);
    return (po.status==='Received'&&received!==ordered)
      ||(po.status==='Part received'&&(received<=0||received>=ordered))
      ||(['Draft','Sent'].includes(po.status)&&received>0);
  }).length);

  push(issues,'supplier-payments-over-purchase-value','critical',state.batches.filter(b=>b.payments.reduce((n,p)=>n+p.amount,0)>b.qty*b.unitCost+.001).length);
  push(issues,'supplier-batches-marked-paid-with-balance','critical',state.batches.filter(b=>b.paid&&b.payments.length>0&&b.payments.reduce((n,p)=>n+p.amount,0)<b.qty*b.unitCost-.001).length);
  push(issues,'overdue-supplier-balances','attention',state.batches.filter(b=>{
    const total=b.qty*b.unitCost;
    const legacy=b.paid&&b.payments.length===0?total:0;
    const paid=b.payments.reduce((n,p)=>n+p.amount,0)+legacy;
    return !!b.dueDate&&b.dueDate<today()&&total-paid>.001;
  }).length);

  const generated=cashflow(state);
  push(issues,'undated-cashflow-events','warning',generated.undated);
  push(issues,'unmatched-cash-movements','attention',generated.entries.filter(e=>!state.accountMatches.some(m=>m.entryId===e.id)).length);

  for(const warning of workspaceIntegrityWarnings(state)){
    if(!issues.some(i=>i.code===warning.key))push(issues,warning.key,'warning',1);
  }

  const criticalCount=issues.filter(i=>i.severity==='critical').reduce((n,i)=>n+i.count,0);
  const warningCount=issues.filter(i=>i.severity==='warning').reduce((n,i)=>n+i.count,0);
  const attentionCount=issues.filter(i=>i.severity==='attention').reduce((n,i)=>n+i.count,0);
  return {
    structuralValid,
    issueCount:criticalCount+warningCount+attentionCount,
    criticalCount,
    warningCount,
    attentionCount,
    issues
  };
}
