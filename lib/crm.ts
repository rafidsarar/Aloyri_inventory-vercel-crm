import { z } from 'zod';
export const statuses = ['New','Confirmed','Ready to pack','Packed','Shipped','Out for delivery','Delivered','Returned','Cancelled'] as const;
export const categories = ['Cleanser','Moisturizer','Sunscreen','Lip care','Other'] as const;
export const channels = ['Facebook','Instagram','WhatsApp','Website','Other'] as const;
export const expenseCategories = ['Advertising','Content','Tools','Packaging','Registration','Courier & returns','Other'] as const;
export const accountIds = ['cash','bank','bkash','nagad'] as const;
export const accountNames:Record<typeof accountIds[number],string>={cash:'Cash',bank:'Bank',bkash:'bKash',nagad:'Nagad'};
const str = z.string().trim().max(2000), id = z.string().min(1).max(100);
const money = z.number().finite().min(0).max(10000000), qty = z.number().int().min(1).max(100000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v);
export const productSchema = z.object({id,name:str.min(1),brand:str,size:str,category:z.string().trim().min(1).max(50),price:money,cost:money,targetQty:z.number().int().min(0).max(100000),reorderAt:z.number().int().min(0).max(100000),active:z.boolean()});
const customerSchema = z.object({id,name:str.min(1),phone:str,address:str,city:str,preference:str,notes:str,consent:z.boolean(),created:date});
const supplierSchema = z.object({
  id,
  name:str.min(1),
  contact:str,
  phone:str,
  email:z.union([z.literal(''),z.string().trim().email().max(200)]).default(''),
  address:str.default(''),
  leadDays:z.number().int().min(0).max(365).default(14),
  paymentTermsDays:z.number().int().min(0).max(365).default(30),
  notes:str,
  verified:z.boolean()
});
const purchaseOrderSchema=z.object({id,number:str.min(1),supplierId:id,created:date,expected:date,status:z.enum(['Draft','Sent','Part received','Received','Cancelled']),notes:str,items:z.array(z.object({productId:id,qty,unitCost:money,receivedQty:z.number().int().min(0).max(100000).default(0)})).min(1).max(100)});
const purchasePaymentSchema=z.object({id,date,amount:money.refine(n=>n>0),note:str.default('')});
const batchSchema = z.object({id,productId:id,qty,unitCost:money,expiry:date,received:date,supplierId:str,invoice:str,dueDate:date.optional(),payments:z.array(purchasePaymentSchema).max(100).default([]),paid:z.boolean(),paidAt:date.optional()});
const stockAdjustmentSchema = z.object({id,batchId:id,delta:z.number().int().min(-100000).max(100000).refine(v=>v!==0),date,reason:str.min(1)});
const inventoryHoldSchema = z.object({id,batchId:id,qty:z.number().int().min(1).max(100000),date,type:z.enum(['Quarantine','Damaged']),reason:str.min(1),source:z.enum(['Manual','Cancelled','Return']).default('Manual'),sourceOrderId:id.optional(),releasedAt:date.optional()});
const allocationSchema = z.object({batchId:id,qty,unitCost:money});
const collectionSchema=z.object({id,date,amount:money.refine(n=>n>0),reference:str.default('')});
const orderStatusSchema=z.preprocess(value=>value==='Processing'?'Ready to pack':value==='Ready to Ship'?'Packed':value,z.enum(statuses));
const orderSchema = z.object({id,number:str,customerId:id,created:date,delivered:date.optional(),returnedAt:date.optional(),settledAt:date.optional(),collections:z.array(collectionSchema).max(100).default([]),channel:z.enum(channels),payment:z.enum(['COD','bKash','Nagad','Bank']),status:orderStatusSchema,items:z.array(z.object({productId:id,qty,price:money,allocations:z.array(allocationSchema).min(1)})).min(1).max(50),discount:money,deliveryCharge:money,courierCost:money,packaging:money,paymentFee:money,returnFee:money,settled:z.boolean(),restocked:z.boolean(),tracking:str,notes:str});
const expenseSchema = z.object({id,category:z.enum(expenseCategories),amount:money,date,notes:str,vendor:str.default(''),reference:str.default(''),recurring:z.enum(['none','monthly']).default('none'),account:z.enum(accountIds).optional()});
const cashEntrySchema = z.object({id,date,kind:z.enum(['in','out']),category:z.string().trim().min(1).max(100),description:str,amount:money.refine(n=>n>0),transferId:id.optional(),reversalOf:id.optional(),reversalReason:z.string().trim().max(300).optional()});
const accountOpeningSchema=z.object({account:z.enum(accountIds),date,balance:money,statementDate:date.optional(),statementBalance:money.optional()});
const accountMatchSchema=z.object({entryId:id,account:z.enum(accountIds),matched:z.boolean(),reference:z.string().trim().max(200)});
const businessProfileSchema=z.object({phone:z.string().trim().max(40),email:z.union([z.literal(''),z.string().trim().email().max(200)]),address:z.string().trim().max(500),bin:z.string().trim().max(60),logoDataUrl:z.union([z.literal(''),z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(150000)]),invoiceFooter:z.string().trim().max(500),returnPolicy:z.string().trim().max(500)});
export const emptyBusinessProfile=()=>({phone:'',email:'',address:'',bin:'',logoDataUrl:'',invoiceFooter:'',returnPolicy:''});
const taskSchema = z.object({
  id,
  customerId:str,
  orderId:str.default(''),
  title:z.string().trim().min(1).max(160),
  due:date,
  done:z.boolean(),
  kind:z.enum(['Follow-up','Replenishment','Other']),
  priority:z.enum(['Low','Normal','High']).default('Normal'),
  channel:z.enum(['WhatsApp','Phone','Messenger','Email','Other']).default('WhatsApp'),
  notes:z.string().trim().max(1000).default(''),
  completedAt:z.union([date,z.literal('')]).default('')
});
const financeCloseSchema=z.object({month:z.string().regex(/^\d{4}-\d{2}$/),closedAt:date,closedBy:str,notes:str.default('')});
export const stateSchema = z.object({products:z.array(productSchema).max(2000),productCategories:z.array(z.string().trim().min(1).max(50)).min(1).max(100).default(()=>[...categories]),customers:z.array(customerSchema).max(10000),suppliers:z.array(supplierSchema).max(1000),purchaseOrders:z.array(purchaseOrderSchema).max(5000).default([]),batches:z.array(batchSchema).max(10000),stockAdjustments:z.array(stockAdjustmentSchema).max(10000).default([]),inventoryHolds:z.array(inventoryHoldSchema).max(10000).default([]),orders:z.array(orderSchema).max(10000),expenses:z.array(expenseSchema).max(10000),cashEntries:z.array(cashEntrySchema).max(10000).default([]),accountOpenings:z.array(accountOpeningSchema).max(4).default([]),accountMatches:z.array(accountMatchSchema).max(30000).default([]),financeCloses:z.array(financeCloseSchema).max(120).default([]),tasks:z.array(taskSchema).max(10000),businessName:str.min(1),businessProfile:businessProfileSchema.default(emptyBusinessProfile)});
export type State=z.infer<typeof stateSchema>;
export type Product=State['products'][number]; export type Customer=State['customers'][number]; export type Order=State['orders'][number]; export type Batch=State['batches'][number];
export type Supplier=State['suppliers'][number]; export type PurchaseOrder=State['purchaseOrders'][number]; export type Task=State['tasks'][number];
export const uid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const shiftDate=(days:number,base=today())=>{const d=new Date(base+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10)};
export const taka=(n:number)=>'৳'+Math.round(n).toLocaleString('en-BD');
export const dateLabel=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export const purchaseOrderValue=(po:PurchaseOrder)=>po.items.reduce((n,i)=>n+i.qty*i.unitCost,0);
export const purchaseOrderUnits=(po:PurchaseOrder)=>po.items.reduce((n,i)=>n+i.qty,0);
export const purchaseOrderReceivedUnits=(po:PurchaseOrder)=>po.items.reduce((n,i)=>n+i.receivedQty,0);
export const purchaseOrderOutstandingUnits=(po:PurchaseOrder)=>Math.max(0,purchaseOrderUnits(po)-purchaseOrderReceivedUnits(po));
export const purchaseOrderProgress=(po:PurchaseOrder)=>{const ordered=purchaseOrderUnits(po);return ordered?Math.round(purchaseOrderReceivedUnits(po)/ordered*100):0};
const calendarDaysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
export function supplierInsight(s:State,supplierId:string){
  const purchaseOrders=s.purchaseOrders.filter(po=>po.supplierId===supplierId);
  const activePurchaseOrders=purchaseOrders.filter(po=>!['Received','Cancelled'].includes(po.status));
  const overduePurchaseOrders=activePurchaseOrders.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today());
  const batches=s.batches.filter(b=>b.supplierId===supplierId);
  const orderedValue=purchaseOrders.filter(po=>po.status!=='Cancelled').reduce((n,po)=>n+purchaseOrderValue(po),0);
  const receivedValue=batches.reduce((n,b)=>n+b.qty*b.unitCost,0);
  const paidValue=batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0;return n+legacy+b.payments.reduce((x,p)=>x+p.amount,0)},0);
  const payable=Math.max(0,receivedValue-paidValue);
  const lastReceived=[...batches].sort((a,b)=>b.received.localeCompare(a.received))[0]?.received||'';
  const leadSamples=purchaseOrders.filter(po=>po.status==='Received').map(po=>{
    const receipts=batches.filter(b=>b.invoice===po.number);
    if(!receipts.length)return null;
    const finalReceipt=[...receipts].sort((a,b)=>b.received.localeCompare(a.received))[0].received;
    return Math.max(0,calendarDaysBetween(po.created,finalReceipt));
  }).filter((value):value is number=>value!==null);
  const avgLeadDays=leadSamples.length?Math.round(leadSamples.reduce((n,v)=>n+v,0)/leadSamples.length):null;
  return {
    purchaseOrders,
    activePurchaseOrders,
    overduePurchaseOrders,
    batches,
    orderedValue,
    receivedValue,
    paidValue,
    payable,
    lastReceived,
    avgLeadDays
  };
}
export function initialState():State {return {businessName:'ALOYRI',businessProfile:emptyBusinessProfile(),productCategories:[...categories],customers:[],suppliers:[],purchaseOrders:[],batches:[],stockAdjustments:[],inventoryHolds:[],orders:[],expenses:[],cashEntries:[],accountOpenings:[],accountMatches:[],financeCloses:[],tasks:[],products:[
  {id:'simple-wash',brand:'Simple',name:'Refreshing Facial Wash',size:'150ml · Poland',category:'Cleanser',price:749,cost:520,targetQty:12,reorderAt:4,active:true},
  {id:'simple-light',brand:'Simple',name:'Hydrating Light Moisturiser',size:'125ml · Hungary',category:'Moisturizer',price:749,cost:520,targetQty:10,reorderAt:4,active:true},
  {id:'simple-rich',brand:'Simple',name:'Replenishing Rich Moisturizer',size:'125ml',category:'Moisturizer',price:775,cost:540,targetQty:6,reorderAt:3,active:true},
  {id:'skin-cafe',brand:'Skin Cafe',name:'Lightweight Sunscreen SPF50 PA+++',size:'60g',category:'Sunscreen',price:549,cost:380,targetQty:12,reorderAt:4,active:true},
  {id:'skin-aqua',brand:'Rohto',name:'Skin Aqua Super Moisture UV Gel',size:'110g · SPF50+ PA++++',category:'Sunscreen',price:1350,cost:940,targetQty:6,reorderAt:3,active:true},
  {id:'cosrx',brand:'COSRX',name:'Low pH Good Morning Gel Cleanser',size:'50ml',category:'Cleanser',price:580,cost:400,targetQty:6,reorderAt:3,active:true}
]};}
export const rawBatchUnits=(s:State,b:Batch)=>b.qty+(s.stockAdjustments||[]).filter(a=>a.batchId===b.id).reduce((n,a)=>n+a.delta,0);
export function usedByBatch(s:State,batchId:string) {return s.orders.filter(o=>o.status!=='Cancelled' && !(o.status==='Returned'&&o.restocked)).flatMap(o=>o.items.flatMap(i=>i.allocations)).filter(a=>a.batchId===batchId).reduce((n,a)=>n+a.qty,0)}
export const activeHoldQty=(s:State,batchId:string)=>s.inventoryHolds.filter(h=>h.batchId===batchId&&!h.releasedAt).reduce((n,h)=>n+h.qty,0);
export const batchRemaining=(s:State,b:Batch)=>rawBatchUnits(s,b)-usedByBatch(s,b.id)-activeHoldQty(s,b.id);
export const stock=(s:State,id:string)=>s.batches.filter(b=>b.productId===id&&b.expiry>today()).reduce((n,b)=>n+Math.max(0,batchRemaining(s,b)),0);
const reservedStatuses=new Set<Order['status']>(['New','Confirmed','Ready to pack','Packed']);
export const reservedByBatch=(s:State,batchId:string)=>s.orders.filter(o=>reservedStatuses.has(o.status)).flatMap(o=>o.items.flatMap(i=>i.allocations)).filter(a=>a.batchId===batchId).reduce((n,a)=>n+a.qty,0);
export const returnedPendingByBatch=(s:State,batchId:string)=>s.orders.filter(o=>o.status==='Returned'&&!o.restocked).flatMap(o=>o.items.flatMap(i=>i.allocations)).filter(a=>a.batchId===batchId).reduce((n,a)=>n+a.qty,0);
export const awayByBatch=(s:State,batchId:string)=>s.orders.filter(o=>['Shipped','Out for delivery','Delivered'].includes(o.status)).flatMap(o=>o.items.flatMap(i=>i.allocations)).filter(a=>a.batchId===batchId).reduce((n,a)=>n+a.qty,0);
export const physicalByBatch=(s:State,b:Batch)=>Math.max(0,rawBatchUnits(s,b)-awayByBatch(s,b.id));
export function stockPosition(s:State,productId:string){
  const batches=s.batches.filter(b=>b.productId===productId);
  const physical=batches.reduce((n,b)=>n+physicalByBatch(s,b),0);
  const available=batches.filter(b=>b.expiry>today()).reduce((n,b)=>n+Math.max(0,batchRemaining(s,b)),0);
  const reserved=batches.filter(b=>b.expiry>today()).reduce((n,b)=>n+reservedByBatch(s,b.id),0);
  const returnedPending=batches.filter(b=>b.expiry>today()).reduce((n,b)=>n+returnedPendingByBatch(s,b.id),0);
  const held=batches.filter(b=>b.expiry>today()).reduce((n,b)=>n+activeHoldQty(s,b.id),0);
  const expired=batches.filter(b=>b.expiry<=today()).reduce((n,b)=>n+physicalByBatch(s,b),0);
  const blocked=held+expired;
  return {physical,available,reserved,returnedPending,held,expired,blocked};
}
export const subtotal=(o:Order)=>o.items.reduce((n,i)=>n+i.price*i.qty,0)-o.discount;
export const total=(o:Order)=>subtotal(o)+o.deliveryCharge;
/** Amount expected from the customer/courier. COD is a net courier remittance; direct payments are gross customer receipts. */
export const receivable=(o:Order)=>o.payment==='COD'?Math.max(0,total(o)-o.courierCost-o.paymentFee):Math.max(0,total(o));
export const collectedAmount=(o:Order)=>o.collections.reduce((n,p)=>n+p.amount,0);
export const orderBalance=(o:Order)=>{if(o.status==='Cancelled'||o.status==='Returned')return 0;const due=receivable(o);const legacy=o.settled&&o.collections.length===0?due:0;return Math.max(0,due-collectedAmount(o)-legacy)};
export const orderPaymentStatus=(o:Order)=>{if(o.status==='Cancelled'||o.status==='Returned')return 'Closed';const collected=collectedAmount(o),balance=orderBalance(o);if(balance<=.001&&receivable(o)>0)return 'Paid';if(collected>0)return 'Part paid';if(o.payment==='COD'&&o.status!=='Delivered')return 'Due on delivery';return 'Pending'};
export const costOfOrder=(o:Order)=>o.items.flatMap(i=>i.allocations).reduce((n,a)=>n+a.unitCost*a.qty,0);
export const contribution=(o:Order)=>subtotal(o)-costOfOrder(o)+o.deliveryCharge-o.courierCost-o.packaging-o.paymentFee;
export function allocate(s:State,productId:string,quantity:number) {let remaining=quantity;const result:{batchId:string;qty:number;unitCost:number}[]=[];for(const b of s.batches.filter(b=>b.productId===productId&&b.expiry>today()).sort((a,b)=>a.expiry.localeCompare(b.expiry))){const amount=Math.min(remaining,batchRemaining(s,b));if(amount>0){result.push({batchId:b.id,qty:amount,unitCost:b.unitCost});remaining-=amount;}if(!remaining)break;}if(remaining)throw new Error('Not enough unexpired stock. Receive stock first.');return result;}
export function nextStatuses(o:Order):Order['status'][] {return ({New:['Confirmed','Cancelled'],Confirmed:['Ready to pack','Cancelled'],'Ready to pack':['Packed','Cancelled'],Packed:['Shipped','Cancelled'],Shipped:['Out for delivery'],'Out for delivery':['Delivered','Returned'],Delivered:['Returned'],Returned:[],Cancelled:[]} as Record<Order['status'],Order['status'][]>)[o.status];}
export function applyCancellationQuarantine(previous:State,next:State):State {
  const result=structuredClone(next),beforeById=new Map(previous.orders.map(o=>[o.id,o]));
  for(const order of result.orders){
    const before=beforeById.get(order.id);
    if(!before||before.status==='Cancelled'||order.status!=='Cancelled')continue;
    const byBatch=new Map<string,number>();
    for(const allocation of order.items.flatMap(i=>i.allocations))byBatch.set(allocation.batchId,(byBatch.get(allocation.batchId)||0)+allocation.qty);
    for(const [batchId,qty] of byBatch){
      const batch=result.batches.find(b=>b.id===batchId);
      if(!batch)throw new Error('Cancelled order refers to a missing inventory batch.');
      if(batch.expiry<=today())continue;
      if(batchRemaining(result,batch)<qty)throw new Error('Cancelled order stock could not be quarantined safely. Refresh inventory and try again.');
      result.inventoryHolds.push({id:uid(),batchId,qty,date:today(),type:'Quarantine',reason:'Cancelled order awaiting inspection',source:'Cancelled',sourceOrderId:order.id});
    }
  }
  return result;
}

/** Create one customer-care reminder when an order is delivered. No message is sent automatically. */
export function applyDeliveryFollowUps(previous:State,next:State):State {
  const result=structuredClone(next),beforeById=new Map(previous.orders.map(o=>[o.id,o]));
  for(const order of result.orders){
    const before=beforeById.get(order.id);
    if(!before||before.status==='Delivered'||order.status!=='Delivered')continue;
    if(result.tasks.some(task=>task.orderId===order.id&&task.kind==='Follow-up'))continue;
    result.tasks.push({
      id:uid(),
      customerId:order.customerId,
      orderId:order.id,
      title:'Post-delivery check-in · #'+order.number,
      due:shiftDate(7,order.delivered||today()),
      done:false,
      kind:'Follow-up',
      priority:'Normal',
      channel:'WhatsApp',
      notes:'Ask whether the products arrived well and how they are working. No message is sent automatically.',
      completedAt:''
    });
  }
  return result;
}
export function validateRelations(s:State,options:{skipOrderNumberUniqueness?:boolean}={}) {
  if(new Set(s.productCategories.map(c=>c.toLowerCase())).size!==s.productCategories.length)throw new Error('Product categories must have unique names.');
  for(const p of s.products)if(!s.productCategories.includes(p.category))throw new Error('A product uses a category that is missing from Inventory.');
  for(const list of [s.products,s.customers,s.suppliers,s.purchaseOrders,s.batches,s.stockAdjustments,s.inventoryHolds,s.orders,s.expenses,s.cashEntries,s.tasks])if(new Set(list.map(x=>x.id)).size!==list.length)throw new Error('Duplicate record identifiers.');
  if(new Set(s.purchaseOrders.map(p=>p.number.toLowerCase())).size!==s.purchaseOrders.length)throw new Error('Purchase order numbers must be unique.');
  if(!options.skipOrderNumberUniqueness&&new Set(s.orders.map(o=>o.number.toLowerCase())).size!==s.orders.length)throw new Error('Order numbers must be unique.');
  if(new Set(s.financeCloses.map(x=>x.month)).size!==s.financeCloses.length)throw new Error('Each month can only be closed once.');
  for(const close of s.financeCloses)if(close.month>today().slice(0,7)||close.closedAt>today())throw new Error('Finance close dates cannot be in the future.');
  if(new Set(s.accountOpenings.map(a=>a.account)).size!==s.accountOpenings.length)throw new Error('Each account needs one opening balance.');
  if(new Set(s.accountMatches.map(m=>m.entryId)).size!==s.accountMatches.length)throw new Error('A cash movement can only be assigned to one account.');
  const movementDates=new Map(cashflow(s).entries.map(e=>[e.id,e.date]));
  for(const a of s.accountOpenings)if(a.date>today()||a.statementDate&&(a.statementDate<a.date||a.statementDate>today()))throw new Error('Check the account opening and statement dates.');
  for(const m of s.accountMatches){const opening=s.accountOpenings.find(a=>a.account===m.account),movementDate=movementDates.get(m.entryId);if(!opening||!movementDate||movementDate<opening.date)throw new Error('An account assignment needs a movement on or after its opening date.');}
  for(const po of s.purchaseOrders){if(!s.suppliers.some(x=>x.id===po.supplierId))throw new Error('Purchase order refers to an unknown supplier.');if(po.expected<po.created)throw new Error('Purchase order expected date cannot be before its creation date.');if(new Set(po.items.map(i=>i.productId)).size!==po.items.length)throw new Error('A product can only appear once on a purchase order.');let received=0;for(const item of po.items){if(!s.products.some(x=>x.id===item.productId))throw new Error('Purchase order refers to an unknown product.');if(item.receivedQty>item.qty)throw new Error('Purchase order received quantity cannot exceed ordered quantity.');received+=item.receivedQty;}const ordered=po.items.reduce((n,i)=>n+i.qty,0);if(po.status==='Received'&&received!==ordered)throw new Error('A received purchase order must have every item fully received.');if(po.status==='Part received'&&(received<=0||received>=ordered))throw new Error('A partially received purchase order must have an outstanding quantity.');if((po.status==='Draft'||po.status==='Sent')&&received>0)throw new Error('Received quantities require a Part received or Received purchase order status.');}
  for(const b of s.batches){if(new Set(b.payments.map(p=>p.id)).size!==b.payments.length)throw new Error('Supplier payment identifiers must be unique within a purchase.');const amount=b.qty*b.unitCost,paidAmount=b.payments.reduce((n,p)=>n+p.amount,0);if(paidAmount>amount+.001)throw new Error('Supplier payments cannot exceed the purchase amount.');if(b.dueDate&&b.dueDate<b.received)throw new Error('Supplier due date cannot be before the stock receipt date.');for(const p of b.payments)if(p.date>today())throw new Error('Supplier payment date cannot be in the future.');if(b.paidAt&&!b.paid)throw new Error('Unpaid stock cannot have a payment date.');}
  for(const o of s.orders){if(new Set(o.collections.map(p=>p.id)).size!==o.collections.length)throw new Error('Collection identifiers must be unique within an order.');const due=receivable(o),collected=o.collections.reduce((n,p)=>n+p.amount,0);if(collected>due+.001)throw new Error('Order collections cannot exceed the receivable.');for(const p of o.collections)if(p.date>today())throw new Error('Collection date cannot be in the future.');if(o.settledAt&&!o.settled)throw new Error('Unsettled orders cannot have a payment date.');if(o.returnedAt&&o.returnedAt>today())throw new Error('Return date cannot be in the future.');}
  for(const a of s.stockAdjustments)if(!s.batches.some(b=>b.id===a.batchId))throw new Error('Stock adjustment refers to an unknown batch.');
  for(const h of s.inventoryHolds){const b=s.batches.find(b=>b.id===h.batchId);if(!b)throw new Error('Inventory hold refers to an unknown batch.');if(h.date>today()||h.releasedAt&&h.releasedAt>today())throw new Error('Inventory hold dates cannot be in the future.');if(h.releasedAt&&h.releasedAt<h.date)throw new Error('Inventory hold release cannot be before the hold date.');if(h.date>=b.expiry)throw new Error('Expired stock is already blocked and cannot be placed on hold.');if(h.source==='Manual'&&h.sourceOrderId)throw new Error('Manual inventory holds cannot reference an order.');if(h.source!=='Manual'){const o=h.sourceOrderId?s.orders.find(o=>o.id===h.sourceOrderId):undefined;if(!o)throw new Error('Order-linked inventory hold refers to an unknown order.');if(h.source==='Cancelled'&&o.status!=='Cancelled')throw new Error('Cancelled-order hold requires a cancelled order.');if(h.source==='Return'&&(o.status!=='Returned'||!o.restocked))throw new Error('Return hold requires a completed return inspection.');}}
  for(const b of s.batches){if(!s.products.some(p=>p.id===b.productId))throw new Error('Unknown product.');if(b.expiry<=b.received)throw new Error('Expiry must be after receipt.');if(b.supplierId&&!s.suppliers.some(p=>p.id===b.supplierId))throw new Error('Unknown supplier.');if(batchRemaining(s,b)<0)throw new Error('Stock is over-allocated.');}
  for(const o of s.orders){if(!s.customers.some(c=>c.id===o.customerId))throw new Error('Select a customer.');if(subtotal(o)<0)throw new Error('Discount exceeds the product total.');if(o.status==='Delivered'&&!o.delivered)throw new Error('Delivery date is required.');if(o.restocked&&o.status!=='Returned')throw new Error('Only returned orders can be restocked.');if(o.returnedAt&&o.status!=='Returned')throw new Error('Only returned orders can have a return date.');if(o.settled&&o.payment==='COD'&&o.status!=='Delivered'&&!(o.status==='Returned'&&!!o.delivered))throw new Error('COD orders can only be settled after delivery.');for(const i of o.items){if(!s.products.some(p=>p.id===i.productId))throw new Error('Unknown product.');if(i.allocations.reduce((n,a)=>n+a.qty,0)!==i.qty)throw new Error('Invalid stock allocation.');for(const a of i.allocations){const b=s.batches.find(b=>b.id===a.batchId);if(!b||b.productId!==i.productId||b.unitCost!==a.unitCost)throw new Error('Invalid batch allocation.');}}}
  const transfers=new Map<string,State['cashEntries']>();for(const e of s.cashEntries)if(e.transferId)transfers.set(e.transferId,[...(transfers.get(e.transferId)||[]),e]);for(const [transferId,list] of transfers){if(list.length!==2||list[0].amount!==list[1].amount||list[0].kind===list[1].kind)throw new Error('Transfer '+transferId+' must have one equal cash-out and cash-in entry.');}
  const reversalCounts=new Map<string,number>();for(const e of s.cashEntries)if(e.reversalOf){const source=s.cashEntries.find(x=>x.id===e.reversalOf);if(!source)throw new Error('Cash reversal refers to a missing source movement.');if(source.reversalOf)throw new Error('A reversal cannot reverse another reversal.');reversalCounts.set(e.reversalOf,(reversalCounts.get(e.reversalOf)||0)+1);}for(const count of reversalCounts.values())if(count>1)throw new Error('A cash movement can only be reversed once.');
  for(const t of s.tasks){
    if(t.customerId&&!s.customers.some(c=>c.id===t.customerId))throw new Error('Unknown follow-up customer.');
    if(t.orderId){
      const order=s.orders.find(o=>o.id===t.orderId);
      if(!order)throw new Error('Follow-up refers to an unknown order.');
      if(t.customerId&&order.customerId!==t.customerId)throw new Error('Follow-up customer does not match the linked order.');
    }
    if(!t.done&&t.completedAt)throw new Error('Open follow-ups cannot have a completion date.');
    if(t.completedAt&&t.completedAt>today())throw new Error('Follow-up completion date cannot be in the future.');
  }
}
export function metrics(s:State) {const delivered=s.orders.filter(o=>o.status==='Delivered');const returned=s.orders.filter(o=>o.status==='Returned');const sales=delivered.reduce((n,o)=>n+subtotal(o),0);const costs=s.expenses.reduce((n,e)=>n+e.amount,0);const returnLoss=returned.reduce((n,o)=>n+(o.restocked?0:costOfOrder(o))+o.courierCost+o.returnFee+o.packaging+o.paymentFee,0);const collectible=s.orders.filter(o=>o.status==='Delivered'||(o.payment!=='COD'&&!['Cancelled','Returned'].includes(o.status)));const profit=delivered.reduce((n,o)=>n+contribution(o),0)-returnLoss-costs;return {sales,profit,expenses:costs,delivered:delivered.length,open:s.orders.filter(o=>!['Delivered','Returned','Cancelled'].includes(o.status)).length,pending:collectible.reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0;return n+Math.max(0,due-o.collections.reduce((x,p)=>x+p.amount,0)-legacy)},0),stockValue:s.batches.filter(b=>b.expiry>today()).reduce((n,b)=>n+batchRemaining(s,b)*b.unitCost,0),stockPurchases:s.batches.reduce((n,b)=>n+b.qty*b.unitCost,0),unpaidStock:s.batches.reduce((n,b)=>n+Math.max(0,b.qty*b.unitCost-b.payments.reduce((x,p)=>x+p.amount,0)-(b.paid&&b.payments.length===0?b.qty*b.unitCost:0)),0)};}
export const accountBalance=(s:State,account:typeof accountIds[number])=>{const opening=s.accountOpenings.find(a=>a.account===account);if(!opening)return null;const links=new Map(s.accountMatches.map(m=>[m.entryId,m]));return opening.balance+cashflow(s).entries.filter(e=>e.date>=opening.date&&links.get(e.id)?.account===account).reduce((n,e)=>n+(e.kind==='in'?e.amount:-e.amount),0)};
export function cashflow(s:State){
  const entries:{id:string;date:string;kind:'in'|'out';source:string;description:string;amount:number}[]=[];
  for(const o of s.orders){const payout=receivable(o);if(o.collections.length)for(const p of o.collections)entries.push({id:'order-collection-'+o.id+'-'+p.id,date:p.date,kind:'in',source:o.status==='Delivered'||!!o.delivered?'Order collection':'Advance customer payment',description:'#'+o.number+(p.reference?' · '+p.reference:''),amount:p.amount});else if(o.status==='Delivered'&&o.settled&&o.settledAt&&payout)entries.push({id:'order-'+o.id,date:o.settledAt,kind:'in',source:'Order settlement',description:'#'+o.number,amount:payout});}
  for(const b of s.batches){const description=b.invoice||s.products.find(p=>p.id===b.productId)?.name||'Stock';if(b.payments.length)for(const p of b.payments)entries.push({id:'batch-payment-'+b.id+'-'+p.id,date:p.date,kind:'out',source:'Stock purchase',description,amount:p.amount});else if(b.paid&&b.paidAt)entries.push({id:'batch-'+b.id,date:b.paidAt,kind:'out',source:'Stock purchase',description,amount:b.qty*b.unitCost});}
  for(const e of s.expenses)entries.push({id:'expense-'+e.id,date:e.date,kind:'out',source:e.category,description:(e.vendor?e.vendor+' · ':'')+(e.notes||'Operating expense')+(e.reference?' · '+e.reference:''),amount:e.amount});
  for(const e of s.cashEntries)entries.push({id:'manual-'+e.id,date:e.date,kind:e.kind,source:e.category,description:e.description||'Other cash movement',amount:e.amount});
  entries.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  return {entries,undated:s.orders.filter(o=>o.settled&&!o.settledAt&&!o.collections.length).length+s.batches.filter(b=>b.paid&&!b.paidAt&&!b.payments.length).length};
}

/** Keep the ALOYRI identity fixed for existing and imported workspaces. */
export const fixedBusinessName = (state:State):State => ({...state,businessName:'ALOYRI',orders:state.orders.map(o=>{if(o.settled&&o.collections.length===0)return o;const due=receivable(o),received=o.collections.reduce((n,p)=>n+p.amount,0),settled=due>0&&received>=due-.001;return {...o,settled,settledAt:settled?(o.collections.at(-1)?.date||o.settledAt):undefined}}),batches:state.batches.map(b=>{const total=b.qty*b.unitCost,paidAmount=b.payments.reduce((n,p)=>n+p.amount,0);if(b.paid&&b.payments.length===0)return b;const paid=total>0&&paidAmount>=total-.001;return {...b,paid,paidAt:paid?(b.payments.at(-1)?.date||b.paidAt):undefined}})});
