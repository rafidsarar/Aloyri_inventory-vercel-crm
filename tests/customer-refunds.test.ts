import test from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance,cashflow,customerPaidAmount,customerRefundPayable,initialState,metrics,refundBalance,stateSchema,validateRelations,type Order } from '../lib/crm.ts';
import { prepareCustomerRefund } from '../lib/customer-refunds.ts';
import { validateWorkspaceChange,visibleState } from '../lib/role-data.ts';
function fixture(payment:Order['payment']='Bank',legacy=false){
 const s=initialState(),productId=s.products[0].id;
 s.customers=[{id:'c',name:'Customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:'2026-01-01'}];
 s.batches=[{id:'b',productId,qty:2,unitCost:500,received:'2026-01-01',expiry:'2099-12-31',supplierId:'',invoice:'',payments:[],paid:false}];
 s.orders=[{id:'o',number:'1001',customerId:'c',created:'2026-01-01',delivered:'2026-01-02',returnedAt:'2026-01-05',status:'Returned',payment,channel:'Website',items:[{productId,qty:1,price:1000,allocations:[{batchId:'b',qty:1,unitCost:500}]}],discount:0,deliveryCharge:0,courierCost:payment==='COD'?100:0,packaging:0,paymentFee:0,returnFee:0,settled:true,settledAt:'2026-01-03',collections:legacy?[]:[{id:'p',date:'2026-01-03',amount:payment==='COD'?900:1000,reference:'original'}],restocked:false,tracking:'',notes:''}];
 s.accountOpenings=[{account:'bank',date:'2026-01-01',balance:500}];
 s.accountMatches=[{entryId:legacy?'order-o':'order-collection-o-p',account:'bank',matched:true,reference:'original'}];
 validateRelations(s);return s;
}
const payment={id:'refund1',orderId:'o',date:'2026-01-06',amount:300,account:'bank' as const,reference:'TXN1',reason:'Product returned'};
test('partial and full refund preserve collections, deduct cash, clear liability without double counting profit or stock',()=>{
 const s=fixture(),before=metrics(s),next=prepareCustomerRefund(s,payment,'finance');
 assert.equal(customerRefundPayable(s),1000);assert.equal(customerRefundPayable(next),700);assert.equal(accountBalance(next,'bank'),1200);
 assert.deepEqual(next.orders,s.orders);assert.equal(metrics(next).profit,before.profit);assert.equal(metrics(next).stockValue,before.stockValue);
 assert.equal(cashflow(next).entries.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0),1000);
 const final=prepareCustomerRefund(next,{...payment,id:'refund2',amount:700},'owner');assert.equal(refundBalance(final,final.orders[0]),0);assert.equal(accountBalance(final,'bank'),500);
 assert.equal(prepareCustomerRefund(next,payment,'finance'),next);assert.equal(next.customerRefunds.length,1);assert.equal(next.accountMatches.at(-1)?.matched,false);
});
test('delivered and subsequently returned legacy settlements keep dated original inflow',()=>{const s=fixture('COD',true);assert.equal(cashflow(s).entries[0].amount,900);assert.equal(customerPaidAmount(s.orders[0]),1000);assert.equal(accountBalance(s,'bank'),1400);});
test('COD refund uses customer gross payment after full remittance, partial remittance only confirms recorded funds',()=>{const s=fixture('COD');assert.equal(customerPaidAmount(s.orders[0]),1000);s.orders[0].collections[0].amount=400;s.orders[0].settled=false;s.orders[0].settledAt=undefined;assert.equal(customerPaidAmount(s.orders[0]),400);});
test('reject overpayment, missing account, invalid date, closed month and non-returned order',()=>{
 const s=fixture();assert.throws(()=>prepareCustomerRefund(s,{...payment,amount:1001},'owner'),/exceeds/);
 assert.throws(()=>prepareCustomerRefund(s,{...payment,account:'cash'},'owner'),/account/);
 assert.throws(()=>prepareCustomerRefund(s,{...payment,date:'2026-01-02'},'owner'),/date/);
 assert.throws(()=>prepareCustomerRefund(s,{...payment,date:'2099-01-01'},'owner'),/date/);
 s.financeCloses=[{month:'2026-01',closedAt:'2026-02-01',closedBy:'Owner',notes:''}];assert.throws(()=>prepareCustomerRefund(s,payment,'owner'),/closed month/);
 s.financeCloses=[];s.orders[0].status='Delivered';s.orders[0].returnedAt=undefined;assert.throws(()=>prepareCustomerRefund(s,payment,'owner'),/returned/);
});
test('refund records are role protected, immutable and only appended by payout workflow',()=>{
 const s=fixture(),next=prepareCustomerRefund(s,payment,'finance');for(const role of ['sales','inventory','viewer'] as const)assert.throws(()=>prepareCustomerRefund(s,payment,role),/FORBIDDEN/);
 assert.equal(visibleState(next,'sales').customerRefunds.length,0);assert.equal(visibleState(next,'inventory').customerRefunds.length,0);
 assert.throws(()=>validateWorkspaceChange(s,next),/Record refund/);validateWorkspaceChange(s,next,{allowNewRefunds:true});
 const removed=structuredClone(next);removed.customerRefunds=[];removed.accountMatches.pop();assert.throws(()=>validateWorkspaceChange(next,removed),/history/);
 assert.throws(()=>prepareCustomerRefund(next,{...payment,amount:200},'finance'),/already used/);
 next.financeCloses.push({month:'2026-01',closedAt:'2026-02-01',closedBy:'Owner',notes:''});validateRelations(next);
});
test('unpaid returns create no customer refund payable and old state documents default to empty refund history',()=>{const s=fixture();s.orders[0].collections=[];s.orders[0].settled=false;s.orders[0].settledAt=undefined;assert.equal(customerRefundPayable(s),0);assert.throws(()=>prepareCustomerRefund(s,payment,'owner'),/exceeds/);const {customerRefunds:_,...old}=s;assert.deepEqual(stateSchema.parse(old).customerRefunds,[]);});

test('legacy direct payments remain in history for returned advances even without delivery',()=>{const s=fixture('Bank',true);s.orders[0].delivered=undefined;assert.equal(cashflow(s).entries[0].amount,1000);assert.equal(customerRefundPayable(s),1000);});
