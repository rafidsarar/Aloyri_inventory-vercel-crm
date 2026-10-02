import { database } from '../db/raw.ts';
import { initialState,shiftDate } from '../lib/crm.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state:any=initialState();
state.customers=[{id:'legacy-c',name:'Legacy',phone:'',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:shiftDate(-5)+'T18:00:00.000Z'}];
state.suppliers=[{id:'legacy-s',name:'Legacy Supplier',contact:'',phone:'',email:'',address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'',verified:true}];
state.purchaseOrders=[{id:'legacy-po',number:'LEGACY-PO',supplierId:'legacy-s',created:shiftDate(-4)+'T09:00:00Z',expected:shiftDate(5)+'T09:00:00Z',status:'Sent',notes:'',items:[{productId:'simple-wash',qty:2,unitCost:500,receivedQty:0}]}];
state.batches=[{id:'legacy-b',productId:'simple-wash',qty:3,unitCost:500,expiry:shiftDate(365)+'T00:00:00.000Z',received:shiftDate(-3)+'T00:00:00.000Z',supplierId:'legacy-s',invoice:'LEGACY',dueDate:shiftDate(20)+'T00:00:00Z',payments:[{id:'legacy-pay',date:shiftDate(-1)+'T00:00:00Z',amount:50,note:''}],paid:false,paidAt:''}];
state.inventoryHolds=[{id:'legacy-h',batchId:'legacy-b',qty:1,date:shiftDate(-1)+'T12:00:00Z',type:'Quarantine',reason:'Legacy',source:'Manual',releasedAt:''}];

const db=database(),now=new Date().toISOString();
await db.prepare("DELETE FROM crm_workspaces WHERE owner_id='legacy-date-owner'").run();
await db.prepare('INSERT INTO crm_workspaces(owner_id,data,version,updated_at) VALUES (?,?,3,?)').bind('legacy-date-owner',JSON.stringify(state),now).run();
console.log('Seeded legacy timestamp fixture');
