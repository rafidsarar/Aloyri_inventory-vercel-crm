import { database } from '@/db/raw';
import { createSession,newSalt,passwordHash } from '@/app/local-auth';
import { initialState,shiftDate,today,validateRelations } from '@/lib/crm';
import type { WorkspaceRole } from '@/lib/roles';

export const dynamic='force-dynamic';

const OWNER='live-usability-audit-owner';
const roles:WorkspaceRole[]=['owner','admin','sales','inventory','finance','viewer'];
const userId=(role:WorkspaceRole)=>role==='owner'?OWNER:'live-usability-audit-'+role;
const email=(role:WorkspaceRole)=>'live-usability-'+role+'@aloyri.test';

async function cleanup(){
  const db=database();
  const statements=[
    "DELETE FROM crm_sessions WHERE user_id IN (SELECT id FROM crm_users WHERE owner_id=?)",
    "DELETE FROM crm_invites WHERE user_id IN (SELECT id FROM crm_users WHERE owner_id=?)",
    "DELETE FROM crm_rel_order_allocations WHERE owner_id=?",
    "DELETE FROM crm_rel_order_items WHERE owner_id=?",
    "DELETE FROM crm_rel_order_collections WHERE owner_id=?",
    "DELETE FROM crm_rel_orders WHERE owner_id=?",
    "DELETE FROM crm_rel_customers WHERE owner_id=?",
    "DELETE FROM crm_rel_batch_payments WHERE owner_id=?",
    "DELETE FROM crm_rel_purchase_order_items WHERE owner_id=?",
    "DELETE FROM crm_rel_inventory_holds WHERE owner_id=?",
    "DELETE FROM crm_rel_stock_adjustments WHERE owner_id=?",
    "DELETE FROM crm_rel_batches WHERE owner_id=?",
    "DELETE FROM crm_rel_purchase_orders WHERE owner_id=?",
    "DELETE FROM crm_rel_suppliers WHERE owner_id=?",
    "DELETE FROM crm_rel_products WHERE owner_id=?",
    "DELETE FROM crm_rel_product_categories WHERE owner_id=?",
    "DELETE FROM crm_rel_finance_account_matches WHERE owner_id=?",
    "DELETE FROM crm_rel_finance_closes WHERE owner_id=?",
    "DELETE FROM crm_rel_finance_cash_entries WHERE owner_id=?",
    "DELETE FROM crm_rel_finance_expenses WHERE owner_id=?",
    "DELETE FROM crm_rel_finance_account_openings WHERE owner_id=?",
    "DELETE FROM crm_relational_migrations WHERE owner_id=?",
    "DELETE FROM crm_domain_versions WHERE owner_id=?",
    "DELETE FROM crm_relational_cutover WHERE owner_id=?",
    "DELETE FROM crm_backup_events WHERE owner_id=?",
    "DELETE FROM crm_data_integrity_events WHERE owner_id=?",
    "DELETE FROM crm_restore_snapshots WHERE owner_id=?",
    "DELETE FROM crm_audit_log WHERE owner_id=?",
    "DELETE FROM crm_security_events WHERE owner_id=?",
    "DELETE FROM crm_workspaces WHERE owner_id=?",
    "DELETE FROM crm_users WHERE owner_id=?"
  ];
  const batch=statements.map(sql=>{
    const q=db.prepare(sql);
    return sql.includes("crm_login_attempts")?q:q.bind(OWNER);
  });
  await db.batch(batch);
}

async function seed(){
  const db=database();
  const existing=await db.prepare('SELECT owner_id FROM crm_workspaces WHERE owner_id=?').bind(OWNER).first<{owner_id:string}>();
  if(existing)return;
  const state=initialState();
  state.products=state.products.map((product,index)=>({...product,active:index===0,targetQty:index===0?20:product.targetQty,reorderAt:index===0?5:product.reorderAt}));
  state.customers=[{id:'audit-customer',name:'Audit Customer',phone:'01711111111',address:'Banani, Dhaka',city:'Dhaka',preference:'Gentle cleanser',notes:'Temporary live usability audit record',consent:true,created:shiftDate(-30)}];
  state.suppliers=[{id:'audit-supplier',name:'Audit Supplier',contact:'Operations',phone:'01811111111',email:'audit-supplier@aloyri.test',address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'Temporary live usability audit record',verified:true}];
  state.purchaseOrders=[{id:'audit-po',number:'AUD-PO-1001',supplierId:'audit-supplier',created:today(),expected:shiftDate(7),status:'Sent',notes:'Live usability audit PO',items:[{productId:'simple-wash',qty:10,unitCost:500,receivedQty:0}]}];
  state.batches=[{id:'audit-batch',productId:'simple-wash',qty:40,unitCost:500,expiry:shiftDate(365),received:shiftDate(-14),supplierId:'audit-supplier',invoice:'AUD-INV-BASE',dueDate:shiftDate(30),payments:[],paid:false}];
  state.orders=[
    {id:'audit-order-open',number:'AUD-1001',customerId:'audit-customer',created:today(),collections:[],channel:'Facebook',payment:'bKash',status:'New',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'audit-batch',qty:1,unitCost:500}]}],discount:0,deliveryCharge:60,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:'Temporary live usability audit order'},
    {id:'audit-order-done',number:'AUD-1000',customerId:'audit-customer',created:shiftDate(-10),delivered:shiftDate(-8),collections:[{id:'audit-col-paid',date:shiftDate(-8),amount:809,reference:'Audit paid'}],channel:'Website',payment:'bKash',status:'Delivered',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'audit-batch',qty:1,unitCost:500}]}],discount:0,deliveryCharge:60,courierCost:50,packaging:20,paymentFee:0,returnFee:0,settled:true,settledAt:shiftDate(-8),restocked:false,tracking:'AUD-TRACK-1000',notes:'Temporary completed audit order'}
  ];
  state.tasks=[{id:'audit-task',customerId:'audit-customer',orderId:'audit-order-done',title:'Audit customer check-in',due:today(),done:false,kind:'Follow-up',priority:'High',channel:'WhatsApp',notes:'Temporary live usability audit reminder',completedAt:''}];
  state.accountOpenings=[{account:'cash',date:shiftDate(-30),balance:20000},{account:'bank',date:shiftDate(-30),balance:30000},{account:'bkash',date:shiftDate(-30),balance:10000},{account:'nagad',date:shiftDate(-30),balance:5000}];
  validateRelations(state,{skipOrderNumberUniqueness:true});
  const now=new Date().toISOString();
  await db.prepare('INSERT INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,0,?)').bind(OWNER,JSON.stringify(state),now).run();
  for(const role of roles){
    const salt=newSalt(),hash=await passwordHash('Live-usability-audit-only-2026!',salt);
    await db.prepare('INSERT INTO crm_users (id,owner_id,email,name,role,password_salt,password_hash,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(userId(role),OWNER,email(role),'Live audit '+role,role,salt,hash,1,now).run();
  }
}

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get('action')==='cleanup'){
    await cleanup();
    return Response.json({ok:true,cleaned:true},{headers:{'Cache-Control':'no-store'}});
  }
  if(url.searchParams.get('action')==='reset')await cleanup();
  await seed();
  const role=url.searchParams.get('role') as WorkspaceRole|null;
  if(!role||!roles.includes(role))return Response.json({ok:true,roles},{headers:{'Cache-Control':'no-store'}});
  return new Response(null,{status:302,headers:{
    'Location':new URL('/',request.url).toString(),
    'Set-Cookie':await createSession(request,userId(role)),
    'Cache-Control':'no-store'
  }});
}
