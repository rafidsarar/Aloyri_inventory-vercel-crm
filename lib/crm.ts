import { z } from 'zod';
export const statuses = ['New','Confirmed','Packed','Shipped','Delivered','Returned','Cancelled'] as const;
export const categories = ['Cleanser','Moisturizer','Sunscreen','Lip care','Other'] as const;
export const channels = ['Facebook','Instagram','WhatsApp','Website','Other'] as const;
export const expenseCategories = ['Advertising','Content','Tools','Packaging','Registration','Courier & returns','Other'] as const;
const str = z.string().trim().max(2000), id = z.string().min(1).max(100);
const money = z.number().finite().min(0).max(10000000), qty = z.number().int().min(1).max(100000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v);
export const productSchema = z.object({id,name:str.min(1),brand:str,size:str,category:z.string().trim().min(1).max(50),price:money,cost:money,targetQty:z.number().int().min(0).max(100000),reorderAt:z.number().int().min(0).max(100000),active:z.boolean()});
const customerSchema = z.object({id,name:str.min(1),phone:str,address:str,city:str,preference:str,notes:str,consent:z.boolean(),created:date});
const supplierSchema = z.object({id,name:str.min(1),contact:str,phone:str,notes:str,verified:z.boolean()});
const batchSchema = z.object({id,productId:id,qty,unitCost:money,expiry:date,received:date,supplierId:str,invoice:str,paid:z.boolean()});
const stockAdjustmentSchema = z.object({id,batchId:id,delta:z.number().int().min(-100000).max(100000).refine(v=>v!==0),date,reason:str.min(1)});
const allocationSchema = z.object({batchId:id,qty,unitCost:money});
const orderSchema = z.object({id,number:str,customerId:id,created:date,delivered:date.optional(),channel:z.enum(channels),payment:z.enum(['COD','bKash','Nagad','Bank']),status:z.enum(statuses),items:z.array(z.object({productId:id,qty,price:money,allocations:z.array(allocationSchema).min(1)})).min(1).max(50),discount:money,deliveryCharge:money,courierCost:money,packaging:money,paymentFee:money,returnFee:money,settled:z.boolean(),restocked:z.boolean(),tracking:str,notes:str});
const expenseSchema = z.object({id,category:z.enum(expenseCategories),amount:money,date,notes:str});
const taskSchema = z.object({id,customerId:str,title:str.min(1),due:date,done:z.boolean(),kind:z.enum(['Follow-up','Replenishment','Other'])});
export const stateSchema = z.object({products:z.array(productSchema).max(2000),productCategories:z.array(z.string().trim().min(1).max(50)).min(1).max(100).default(()=>[...categories]),customers:z.array(customerSchema).max(10000),suppliers:z.array(supplierSchema).max(1000),batches:z.array(batchSchema).max(10000),stockAdjustments:z.array(stockAdjustmentSchema).max(10000).default([]),orders:z.array(orderSchema).max(10000),expenses:z.array(expenseSchema).max(10000),tasks:z.array(taskSchema).max(10000),budget:money,businessName:str.min(1)});
export type State=z.infer<typeof stateSchema>;
export type Product=State['products'][number]; export type Customer=State['customers'][number]; export type Order=State['orders'][number]; export type Batch=State['batches'][number];
export type Supplier=State['suppliers'][number]; export type Task=State['tasks'][number];
export const uid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const shiftDate=(days:number,base=today())=>{const d=new Date(base+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10)};
export const taka=(n:number)=>'৳'+Math.round(n).toLocaleString('en-BD');
export const dateLabel=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export function initialState():State {return {businessName:'My skincare business',budget:120000,productCategories:[...categories],customers:[],suppliers:[],batches:[],stockAdjustments:[],orders:[],expenses:[],tasks:[],products:[
  {id:'simple-wash',brand:'Simple',name:'Refreshing Facial Wash',size:'150ml · Poland',category:'Cleanser',price:749,cost:520,targetQty:12,reorderAt:4,active:true},
  {id:'simple-light',brand:'Simple',name:'Hydrating Light Moisturiser',size:'125ml · Hungary',category:'Moisturizer',price:749,cost:520,targetQty:10,reorderAt:4,active:true},
  {id:'simple-rich',brand:'Simple',name:'Replenishing Rich Moisturizer',size:'125ml',category:'Moisturizer',price:775,cost:540,targetQty:6,reorderAt:3,active:true},
  {id:'skin-cafe',brand:'Skin Cafe',name:'Lightweight Sunscreen SPF50 PA+++',size:'60g',category:'Sunscreen',price:549,cost:380,targetQty:12,reorderAt:4,active:true},
  {id:'skin-aqua',brand:'Rohto',name:'Skin Aqua Super Moisture UV Gel',size:'110g · SPF50+ PA++++',category:'Sunscreen',price:1350,cost:940,targetQty:6,reorderAt:3,active:true},
  {id:'cosrx',brand:'COSRX',name:'Low pH Good Morning Gel Cleanser',size:'50ml',category:'Cleanser',price:580,cost:400,targetQty:6,reorderAt:3,active:true}
]};}
export function usedByBatch(s:State,batchId:string) {return s.orders.filter(o=>o.status!=='Cancelled' && !(o.status==='Returned'&&o.restocked)).flatMap(o=>o.items.flatMap(i=>i.allocations)).filter(a=>a.batchId===batchId).reduce((n,a)=>n+a.qty,0)}
export const batchRemaining=(s:State,b:Batch)=>b.qty+(s.stockAdjustments||[]).filter(a=>a.batchId===b.id).reduce((n,a)=>n+a.delta,0)-usedByBatch(s,b.id);
export const stock=(s:State,id:string)=>s.batches.filter(b=>b.productId===id&&b.expiry>today()).reduce((n,b)=>n+batchRemaining(s,b),0);
export const subtotal=(o:Order)=>o.items.reduce((n,i)=>n+i.price*i.qty,0)-o.discount;
export const total=(o:Order)=>subtotal(o)+o.deliveryCharge;
export const costOfOrder=(o:Order)=>o.items.flatMap(i=>i.allocations).reduce((n,a)=>n+a.unitCost*a.qty,0);
export const contribution=(o:Order)=>subtotal(o)-costOfOrder(o)+o.deliveryCharge-o.courierCost-o.packaging-o.paymentFee;
export function allocate(s:State,productId:string,quantity:number) {let remaining=quantity;const result:{batchId:string;qty:number;unitCost:number}[]=[];for(const b of s.batches.filter(b=>b.productId===productId&&b.expiry>today()).sort((a,b)=>a.expiry.localeCompare(b.expiry))){const amount=Math.min(remaining,batchRemaining(s,b));if(amount>0){result.push({batchId:b.id,qty:amount,unitCost:b.unitCost});remaining-=amount;}if(!remaining)break;}if(remaining)throw new Error('Not enough unexpired stock. Receive stock first.');return result;}
export function nextStatuses(o:Order):Order['status'][] {return ({New:['Confirmed','Cancelled'],Confirmed:['Packed','Cancelled'],Packed:['Shipped','Cancelled'],Shipped:['Delivered','Returned'],Delivered:[],Returned:[],Cancelled:[]} as Record<string,Order['status'][]>)[o.status];}
export function validateRelations(s:State) {
  if(new Set(s.productCategories.map(c=>c.toLowerCase())).size!==s.productCategories.length)throw new Error('Product categories must have unique names.');
  for(const p of s.products)if(!s.productCategories.includes(p.category))throw new Error('A product uses a category that is missing from Inventory.');
  for(const list of [s.products,s.customers,s.suppliers,s.batches,s.stockAdjustments,s.orders,s.expenses,s.tasks])if(new Set(list.map(x=>x.id)).size!==list.length)throw new Error('Duplicate record identifiers.');
  for(const a of s.stockAdjustments)if(!s.batches.some(b=>b.id===a.batchId))throw new Error('Stock adjustment refers to an unknown batch.');
  for(const b of s.batches){if(!s.products.some(p=>p.id===b.productId))throw new Error('Unknown product.');if(b.expiry<=b.received)throw new Error('Expiry must be after receipt.');if(b.supplierId&&!s.suppliers.some(p=>p.id===b.supplierId))throw new Error('Unknown supplier.');if(batchRemaining(s,b)<0)throw new Error('Stock is over-allocated.');}
  for(const o of s.orders){if(!s.customers.some(c=>c.id===o.customerId))throw new Error('Select a customer.');if(subtotal(o)<0)throw new Error('Discount exceeds the product total.');if(o.status==='Delivered'&&!o.delivered)throw new Error('Delivery date is required.');if(o.settled&&o.status!=='Delivered')throw new Error('Only delivered orders can be settled.');for(const i of o.items){if(!s.products.some(p=>p.id===i.productId))throw new Error('Unknown product.');if(i.allocations.reduce((n,a)=>n+a.qty,0)!==i.qty)throw new Error('Invalid stock allocation.');for(const a of i.allocations){const b=s.batches.find(b=>b.id===a.batchId);if(!b||b.productId!==i.productId||b.unitCost!==a.unitCost)throw new Error('Invalid batch allocation.');}}}
  for(const t of s.tasks)if(t.customerId&&!s.customers.some(c=>c.id===t.customerId))throw new Error('Unknown follow-up customer.');
}
export function metrics(s:State) {const delivered=s.orders.filter(o=>o.status==='Delivered');const returned=s.orders.filter(o=>o.status==='Returned');const sales=delivered.reduce((n,o)=>n+subtotal(o),0);const costs=s.expenses.reduce((n,e)=>n+e.amount,0);const profit=delivered.reduce((n,o)=>n+contribution(o),0)-returned.reduce((n,o)=>n+o.courierCost+o.returnFee+o.packaging+o.paymentFee,0)-costs;return {sales,profit,expenses:costs,delivered:delivered.length,open:s.orders.filter(o=>!['Delivered','Returned','Cancelled'].includes(o.status)).length,pending:delivered.filter(o=>!o.settled).reduce((n,o)=>n+total(o)-o.courierCost-o.paymentFee,0),stockValue:s.batches.reduce((n,b)=>n+batchRemaining(s,b)*b.unitCost,0),stockPurchases:s.batches.reduce((n,b)=>n+b.qty*b.unitCost,0),unpaidStock:s.batches.filter(b=>!b.paid).reduce((n,b)=>n+b.qty*b.unitCost,0)};}
