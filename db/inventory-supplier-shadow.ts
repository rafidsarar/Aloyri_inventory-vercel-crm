import { returnLedgerStatements } from './return-ledgers.ts';
import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';
import { fixedBusinessName, stateSchema, validateRelations, type State } from '../lib/crm.ts';

export const INVENTORY_SUPPLIER_DOMAIN='inventory-suppliers';

type WorkspaceRow={data:string;version:number};
type MigrationRow={status:string;source_version:number;verified_at:string|null;updated_at:string};

export async function loadInventorySupplierWorkspace(ownerId:string){
  const row=await database().prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');
  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});
  return {row,state};
}

export async function getInventorySupplierMigrationStatus(ownerId:string){
  await ensureRelationalFoundation();
  return database().prepare('SELECT status,source_version,verified_at,updated_at FROM crm_relational_migrations WHERE owner_id=? AND domain=?')
    .bind(ownerId,INVENTORY_SUPPLIER_DOMAIN).first<MigrationRow>();
}

export function inventorySupplierShadowStatements(ownerId:string,state:State,sourceVersion:number,now=new Date().toISOString()){
  const db=database(),q:any[]=[];
  q.push(db.prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,migrated_at=EXCLUDED.migrated_at,verified_at=NULL,updated_at=EXCLUDED.updated_at').bind(ownerId,INVENTORY_SUPPLIER_DOMAIN,'migrating',sourceVersion,now,null,now));
  for(const table of ['crm_rel_batch_payments','crm_rel_purchase_order_items','crm_rel_inventory_holds','crm_rel_stock_adjustments','crm_rel_batches','crm_rel_purchase_orders','crm_rel_suppliers','crm_rel_products','crm_rel_product_categories'])
    q.push(db.prepare('DELETE FROM '+table+' WHERE owner_id=?').bind(ownerId));
  state.productCategories.forEach((name,i)=>q.push(db.prepare('INSERT INTO crm_rel_product_categories (owner_id,name,sort_order,record_version,updated_at) VALUES (?,?,?,?,?)').bind(ownerId,name,i,0,now)));
  state.products.forEach(p=>q.push(db.prepare('INSERT INTO crm_rel_products (owner_id,id,name,brand,size,category,price,cost,target_qty,reorder_at,active,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(ownerId,p.id,p.name,p.brand,p.size,p.category,p.price,p.cost,p.targetQty,p.reorderAt,p.active,0,now,now)));
  state.suppliers.forEach(s=>q.push(db.prepare('INSERT INTO crm_rel_suppliers (owner_id,id,name,contact,phone,email,address,lead_days,payment_terms_days,notes,verified,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(ownerId,s.id,s.name,s.contact,s.phone,s.email,s.address,s.leadDays,s.paymentTermsDays,s.notes,s.verified,0,now,now)));
  state.purchaseOrders.forEach(po=>{
    q.push(db.prepare('INSERT INTO crm_rel_purchase_orders (owner_id,id,number,supplier_id,created,expected,status,notes,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(ownerId,po.id,po.number,po.supplierId,po.created,po.expected,po.status,po.notes,0,now,now));
    po.items.forEach((item,lineNo)=>q.push(db.prepare('INSERT INTO crm_rel_purchase_order_items (owner_id,purchase_order_id,line_no,product_id,qty,unit_cost,received_qty) VALUES (?,?,?,?,?,?,?)').bind(ownerId,po.id,lineNo,item.productId,item.qty,item.unitCost,item.receivedQty)));
  });
  state.batches.forEach(b=>{
    q.push(db.prepare('INSERT INTO crm_rel_batches (owner_id,id,product_id,qty,unit_cost,expiry,received,supplier_id,invoice,due_date,paid,paid_at,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(ownerId,b.id,b.productId,b.qty,b.unitCost,b.expiry,b.received,b.supplierId,b.invoice,b.dueDate||null,b.paid,b.paidAt||null,0,now,now));
    b.payments.forEach(p=>q.push(db.prepare('INSERT INTO crm_rel_batch_payments (owner_id,batch_id,id,date,amount,note) VALUES (?,?,?,?,?,?)').bind(ownerId,b.id,p.id,p.date,p.amount,p.note)));
  });
  state.stockAdjustments.forEach(a=>q.push(db.prepare('INSERT INTO crm_rel_stock_adjustments (owner_id,id,batch_id,delta,date,reason,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(ownerId,a.id,a.batchId,a.delta,a.date,a.reason,0,now,now)));
  state.inventoryHolds.forEach(h=>q.push(db.prepare('INSERT INTO crm_rel_inventory_holds (owner_id,id,batch_id,qty,date,type,reason,source,source_order_id,released_at,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(ownerId,h.id,h.batchId,h.qty,h.date,h.type,h.reason,h.source,h.sourceOrderId||null,h.releasedAt||null,0,now,now)));
  q.push(db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',sourceVersion,now,now,ownerId,INVENTORY_SUPPLIER_DOMAIN));
  q.push(...returnLedgerStatements(ownerId,state,['returnInspections']));
  return q;
}

export async function migrateInventorySupplierShadow(ownerId:string,state:State,sourceVersion:number){
  await ensureRelationalFoundation();
  await database().batch(inventorySupplierShadowStatements(ownerId,state,sourceVersion));
  return {sourceVersion,counts:{products:state.products.length,suppliers:state.suppliers.length,purchaseOrders:state.purchaseOrders.length,batches:state.batches.length,stockAdjustments:state.stockAdjustments.length,inventoryHolds:state.inventoryHolds.length}};
}

export async function ensureInventorySupplierApiReady(ownerId:string){
  await ensureRelationalFoundation();
  const {row,state}=await loadInventorySupplierWorkspace(ownerId);
  const migration=await getInventorySupplierMigrationStatus(ownerId);
  if(!migration||migration.status!=='verified')await migrateInventorySupplierShadow(ownerId,state,row.version);
  return {row,state};
}

