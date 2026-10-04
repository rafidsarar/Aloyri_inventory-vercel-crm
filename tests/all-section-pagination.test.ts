import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState,metrics,cashflow,accountBalance,customerRefundPayable,customerCreditPayable,type Order } from '../lib/crm.ts';
import { sectionKinds,sectionPage,sectionRecordIds,type SectionKind } from '../lib/section-records.ts';
import { financialPeriod } from '../lib/financial-reporting.ts';
const request={page:1,pageSize:25,q:'',status:'All'};
function workspace(){
 const s=initialState(),product=s.products[0];s.productCategories=[];s.products=[];
 for(let i=0;i<63;i++){
  const suffix=String(i).padStart(3,'0'),p='product-'+suffix,b='batch-'+suffix,c='customer-'+suffix,returned='return-'+suffix,newOrder='new-'+suffix;
  s.products.push({...product,id:p,name:'Product '+suffix,category:'Category '+suffix,active:true,reorderAt:1000});s.productCategories.push('Category '+suffix);
  s.customers.push({id:c,name:'Customer '+suffix,phone:'',address:'',city:'Dhaka',preference:'',notes:'',consent:false,created:'2026-01-01'});
  s.suppliers.push({id:'supplier-'+suffix,name:'Supplier '+suffix,contact:'',phone:'',email:'',address:'',leadDays:14,paymentTermsDays:30,notes:'',verified:false});
  s.batches.push({id:b,productId:p,qty:500,unitCost:10,received:'2026-01-01',expiry:'2099-12-31',supplierId:'supplier-'+suffix,invoice:'Invoice '+suffix,payments:[],paid:false});
  s.purchaseOrders.push({id:'po-'+suffix,number:'PO-'+suffix,supplierId:'supplier-'+suffix,created:'2026-01-01',expected:'2026-02-01',status:'Draft',notes:'',items:[{productId:p,qty:10,unitCost:10,receivedQty:0}]});
  const o:Order={id:newOrder,number:'NEW-'+suffix,customerId:c,created:'2026-01-01',collections:[],channel:'Website',payment:'Bank',status:'New',items:[{productId:p,qty:1,price:20,allocations:[{batchId:b,qty:1,unitCost:10}]}],discount:0,deliveryCharge:0,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:''};
  s.orders.push(o,{...o,id:returned,number:'RETURN-'+suffix,status:'Returned',delivered:'2026-01-02',returnedAt:'2026-01-03',collections:[{id:'collection-'+suffix,date:'2026-01-02',amount:20,reference:''}]});
  s.tasks.push({id:'task-'+suffix,customerId:c,orderId:newOrder,title:'Reminder '+suffix,due:'2026-01-01',done:false,kind:'Follow-up',priority:'High',channel:'WhatsApp',notes:'',completedAt:''});
  s.inventoryHolds.push({id:'hold-'+suffix,batchId:b,qty:1,date:'2026-01-01',reason:'Damaged',type:'Damaged',source:'Manual'},{id:'cancel-'+suffix,batchId:b,qty:1,date:'2026-01-01',reason:'Inspect',type:'Quarantine',source:'Cancelled',sourceOrderId:newOrder});
  s.expenses.push({id:'expense-'+suffix,date:'2026-01-01',category:'Advertising',amount:1,notes:'',vendor:'',reference:'',recurring:'none'});
  s.cashEntries.push({id:'cash-'+suffix,date:'2026-01-01',kind:'in',category:'Other',description:'Movement '+suffix,amount:1});
  s.accountMatches.push({entryId:'manual-cash-'+suffix,account:'cash',matched:false,reference:''},{entryId:'orphan-'+suffix,account:'cash',matched:false,reference:''});
  s.customerRefunds.push({id:'refund-'+suffix,orderId:returned,date:'2026-01-03',amount:1,account:'cash',reference:'',reason:'Returned'});
  s.returnSettlements.push({id:'credit-'+suffix,orderId:returned,date:'2026-01-03',kind:'Store credit',amount:15,reason:'Agreed'});
  s.creditUses.push({id:'use-'+suffix,settlementId:'credit-'+suffix,orderId:newOrder,date:'2026-01-03',amount:1});
 }
 s.accountOpenings=[{account:'cash',date:'2026-01-01',balance:1000}];return s;
}
test('every growing section list has bounded, non-overlapping pages and complete totals',()=>{
 const s=workspace(),before=JSON.stringify(s);
 for(const kind of Object.keys(sectionKinds) as SectionKind[]){
  const options={range:'all',account:'cash'},all=sectionRecordIds(s,kind,request,options);assert.ok(all.length>25,kind+' must exercise more than one page');
  const pages=[];for(let page=1;page<=Math.ceil(all.length/25);page++){const result=sectionPage(s,kind,{...request,page},options);assert.ok(result.ids.length<=25,kind);assert.equal(result.pagination.total,all.length);pages.push(...result.ids)}
  assert.deepEqual(pages,all,kind);assert.equal(new Set(pages).size,pages.length,kind+' duplicates');
 }
 assert.equal(JSON.stringify(s),before,'pagination cannot mutate accounting/stock records');
});
test('paging financial histories preserves all-record balances, liabilities and historical reporting',()=>{
 const s=workspace(),before={metrics:metrics(s),flow:cashflow(s),balance:accountBalance(s,'cash'),refund:customerRefundPayable(s),credit:customerCreditPayable(s),report:financialPeriod(s,'2026-01')};
 for(const kind of ['collections','collectionHistory','payables','expenses','cashflow','refundOrders','refundHistory','credits','creditHistory','assigned','unassigned'] as SectionKind[])sectionPage(s,kind,{...request,page:3},{range:'all',account:'cash'});
 assert.deepEqual({metrics:metrics(s),flow:cashflow(s),balance:accountBalance(s,'cash'),refund:customerRefundPayable(s),credit:customerCreditPayable(s),report:financialPeriod(s,'2026-01')},before);
 assert.equal(before.credit,63*14);assert.equal(before.flow.entries.filter(e=>e.source==='Customer refund').length,63);
});
test('search and filters include matches beyond page one, including literal wildcard characters',()=>{
 const s=workspace();assert.deepEqual(sectionPage(s,'products',{...request,q:'Product 062'}).ids,['product-062']);assert.deepEqual(sectionPage(s,'suppliers',{...request,q:'Supplier 062'}).ids,['supplier-062']);assert.deepEqual(sectionPage(s,'tasks',{...request,q:'Reminder 062'}).ids,['task-062']);
 s.purchaseOrders[62].notes='100%_ complete';assert.deepEqual(sectionPage(s,'purchaseOrders',{...request,q:'%_'}).ids,['po-062']);assert.equal(sectionPage(s,'tasks',{...request,status:'Completed'}).pagination.total,0);assert.equal(sectionPage(s,'batches',{...request,status:'Expired'}).pagination.total,0);
});
