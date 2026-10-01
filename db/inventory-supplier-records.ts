import { database } from './raw.ts';
import { applyRoleChanges, validateWorkspaceChange } from '../lib/role-data.ts';
import { fixedBusinessName, stateSchema, validateRelations, type State } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureInventorySupplierApiReady, INVENTORY_SUPPLIER_DOMAIN, migrateInventorySupplierShadow } from './inventory-supplier-shadow.ts';

export const inventorySupplierKeys=['products','productCategories','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds'] as const;
export type InventorySupplierKey=typeof inventorySupplierKeys[number];
export type InventorySupplierData=Pick<State,InventorySupplierKey>;
type Actor={userId:string;name:string;role:WorkspaceRole};

export function inventorySupplierData(state:State):InventorySupplierData{
  return Object.fromEntries(inventorySupplierKeys.map(key=>[key,state[key]])) as InventorySupplierData;
}
export function inventorySupplierSectionsChanged(a:State,b:State){
  return inventorySupplierKeys.some(key=>JSON.stringify(a[key])!==JSON.stringify(b[key]));
}

async function ensureAudit(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

export async function getInventorySupplierDomain(ownerId:string){
  const {row}=await ensureInventorySupplierApiReady(ownerId),db=database();
  const [categories,products,suppliers,pos,poItems,batches,payments,adjustments,holds]=await Promise.all([
    db.prepare('SELECT name FROM crm_rel_product_categories WHERE owner_id=? ORDER BY sort_order,name').bind(ownerId).all<any>(),
    db.prepare('SELECT id,name,brand,size,category,price,cost,target_qty,reorder_at,active FROM crm_rel_products WHERE owner_id=? ORDER BY name,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,name,contact,phone,email,address,lead_days,payment_terms_days,notes,verified FROM crm_rel_suppliers WHERE owner_id=? ORDER BY name,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,number,supplier_id,created,expected,status,notes FROM crm_rel_purchase_orders WHERE owner_id=? ORDER BY created DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT purchase_order_id,line_no,product_id,qty,unit_cost,received_qty FROM crm_rel_purchase_order_items WHERE owner_id=? ORDER BY purchase_order_id,line_no').bind(ownerId).all<any>(),
    db.prepare('SELECT id,product_id,qty,unit_cost,expiry,received,supplier_id,invoice,due_date,paid,paid_at FROM crm_rel_batches WHERE owner_id=? ORDER BY received DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT batch_id,id,date,amount,note FROM crm_rel_batch_payments WHERE owner_id=? ORDER BY batch_id,date,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,batch_id,delta,date,reason FROM crm_rel_stock_adjustments WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,batch_id,qty,date,type,reason,source,source_order_id,released_at FROM crm_rel_inventory_holds WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>()
  ]);
  const data={
    productCategories:categories.results.map((x:any)=>x.name),
    products:products.results.map((x:any)=>({id:x.id,name:x.name,brand:x.brand,size:x.size,category:x.category,price:Number(x.price),cost:Number(x.cost),targetQty:Number(x.target_qty),reorderAt:Number(x.reorder_at),active:Boolean(x.active)})),
    suppliers:suppliers.results.map((x:any)=>({id:x.id,name:x.name,contact:x.contact,phone:x.phone,email:x.email,address:x.address,leadDays:Number(x.lead_days),paymentTermsDays:Number(x.payment_terms_days),notes:x.notes,verified:Boolean(x.verified)})),
    purchaseOrders:pos.results.map((x:any)=>({id:x.id,number:x.number,supplierId:x.supplier_id,created:String(x.created),expected:String(x.expected),status:x.status,notes:x.notes,items:poItems.results.filter((i:any)=>i.purchase_order_id===x.id).map((i:any)=>({productId:i.product_id,qty:Number(i.qty),unitCost:Number(i.unit_cost),receivedQty:Number(i.received_qty)}))})),
    batches:batches.results.map((x:any)=>({id:x.id,productId:x.product_id,qty:Number(x.qty),unitCost:Number(x.unit_cost),expiry:String(x.expiry),received:String(x.received),supplierId:x.supplier_id,invoice:x.invoice,dueDate:x.due_date?String(x.due_date):undefined,paid:Boolean(x.paid),paidAt:x.paid_at?String(x.paid_at):undefined,payments:payments.results.filter((p:any)=>p.batch_id===x.id).map((p:any)=>({id:p.id,date:String(p.date),amount:Number(p.amount),note:p.note}))})),
    stockAdjustments:adjustments.results.map((x:any)=>({id:x.id,batchId:x.batch_id,delta:Number(x.delta),date:String(x.date),reason:x.reason})),
    inventoryHolds:holds.results.map((x:any)=>({id:x.id,batchId:x.batch_id,qty:Number(x.qty),date:String(x.date),type:x.type,reason:x.reason,source:x.source,sourceOrderId:x.source_order_id||undefined,releasedAt:x.released_at?String(x.released_at):undefined}))
  };
  const parsed=stateSchema.pick({products:true,productCategories:true,suppliers:true,purchaseOrders:true,batches:true,stockAdjustments:true,inventoryHolds:true}).parse(data);
  return {data:parsed,version:row.version};
}

export async function saveInventorySupplierDomain(ownerId:string,input:unknown,expectedVersion:number,actor:Actor){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('WORKSPACE_VERSION_REQUIRED');
  const parsed=stateSchema.pick({
    products:true,productCategories:true,suppliers:true,purchaseOrders:true,batches:true,stockAdjustments:true,inventoryHolds:true
  }).safeParse(input);
  if(!parsed.success)throw new Error('INVALID_INVENTORY_SUPPLIER_DATA');
  const {row,state}=await ensureInventorySupplierApiReady(ownerId);
  if(row.version!==expectedVersion)throw new Error('WORKSPACE_VERSION_CONFLICT');
  const candidate=structuredClone(state);
  for(const key of inventorySupplierKeys)(candidate[key] as any)=parsed.data[key] as any;
  let next:State;
  try{next=fixedBusinessName(applyRoleChanges(state,candidate,actor.role));}catch(error){throw new Error(error instanceof Error?error.message:'ROLE_FORBIDDEN')}
  validateWorkspaceChange(state,next);validateRelations(next,{skipOrderNumberUniqueness:true});
  const changed=inventorySupplierKeys.filter(key=>JSON.stringify(state[key])!==JSON.stringify(next[key]));
  if(!changed.length)return {data:inventorySupplierData(state),version:row.version};
  const now=new Date().toISOString(),db=database(),nextVersion=row.version+1;
  await ensureAudit();
  const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
    .bind(JSON.stringify(next),now,ownerId,row.version).run();
  if(!result.meta.changes)throw new Error('WORKSPACE_VERSION_CONFLICT');
  await migrateInventorySupplierShadow(ownerId,next,nextVersion);
  await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,'Updated '+changed.join(', '),JSON.stringify(changed),now).run();
  return {data:inventorySupplierData(next),version:nextVersion};
}

export async function markInventorySupplierShadowStale(ownerId:string,sourceVersion:number){
  const now=new Date().toISOString();
  await database().prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=NULL,updated_at=EXCLUDED.updated_at')
    .bind(ownerId,INVENTORY_SUPPLIER_DOMAIN,'stale',sourceVersion,null,null,now).run();
}
