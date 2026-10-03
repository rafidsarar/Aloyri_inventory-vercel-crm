import { readReturnLedger } from './return-ledgers.ts';
import { database } from './raw.ts';
import { optionalRelationalDate, relationalDate } from './relational-date.ts';
import { getDomainVersion,domainVersionBumpStatements } from './domain-version.ts';
import { applyRoleChanges, validateWorkspaceChange, visibleState } from '../lib/role-data.ts';
import { today,uid,fixedBusinessName, stateSchema, validateRelations, type State } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureInventorySupplierApiReady, INVENTORY_SUPPLIER_DOMAIN, inventorySupplierShadowStatements } from './inventory-supplier-shadow.ts';

export const inventorySupplierKeys=['products','productCategories','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds','returnInspections'] as const;
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
  const [categories,products,suppliers,pos,poItems,batches,payments,adjustments,holds,domainVersion]=await Promise.all([
    db.prepare('SELECT name FROM crm_rel_product_categories WHERE owner_id=? ORDER BY sort_order,name').bind(ownerId).all<any>(),
    db.prepare('SELECT id,name,brand,size,category,price,cost,target_qty,reorder_at,active FROM crm_rel_products WHERE owner_id=? ORDER BY name,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,name,contact,phone,email,address,lead_days,payment_terms_days,notes,verified FROM crm_rel_suppliers WHERE owner_id=? ORDER BY name,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,number,supplier_id,created,expected,status,notes FROM crm_rel_purchase_orders WHERE owner_id=? ORDER BY created DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT purchase_order_id,line_no,product_id,qty,unit_cost,received_qty FROM crm_rel_purchase_order_items WHERE owner_id=? ORDER BY purchase_order_id,line_no').bind(ownerId).all<any>(),
    db.prepare('SELECT id,product_id,qty,unit_cost,expiry,received,supplier_id,invoice,due_date,paid,paid_at FROM crm_rel_batches WHERE owner_id=? ORDER BY received DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT batch_id,id,date,amount,note FROM crm_rel_batch_payments WHERE owner_id=? ORDER BY batch_id,date,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,batch_id,delta,date,reason FROM crm_rel_stock_adjustments WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>(),
    db.prepare('SELECT id,batch_id,qty,date,type,reason,source,source_order_id,released_at FROM crm_rel_inventory_holds WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>(),
    getDomainVersion(ownerId,INVENTORY_SUPPLIER_DOMAIN)
  ]);
  const poItemsByOrder=new Map<string,any[]>();
  for(const item of poItems.results){const list=poItemsByOrder.get(item.purchase_order_id);if(list)list.push(item);else poItemsByOrder.set(item.purchase_order_id,[item]);}
  const paymentsByBatch=new Map<string,any[]>();
  for(const payment of payments.results){const list=paymentsByBatch.get(payment.batch_id);if(list)list.push(payment);else paymentsByBatch.set(payment.batch_id,[payment]);}
  const data={
  returnInspections:await readReturnLedger(ownerId,'returnInspections'),

    productCategories:categories.results.map((x:any)=>x.name),
    products:products.results.map((x:any)=>({id:x.id,name:x.name,brand:x.brand,size:x.size,category:x.category,price:Number(x.price),cost:Number(x.cost),targetQty:Number(x.target_qty),reorderAt:Number(x.reorder_at),active:Boolean(x.active)})),
    suppliers:suppliers.results.map((x:any)=>({id:x.id,name:x.name,contact:x.contact,phone:x.phone,email:x.email,address:x.address,leadDays:Number(x.lead_days),paymentTermsDays:Number(x.payment_terms_days),notes:x.notes,verified:Boolean(x.verified)})),
    purchaseOrders:pos.results.map((x:any)=>({id:x.id,number:x.number,supplierId:x.supplier_id,created:relationalDate(x.created),expected:relationalDate(x.expected),status:x.status,notes:x.notes,items:(poItemsByOrder.get(x.id)||[]).map((i:any)=>({productId:i.product_id,qty:Number(i.qty),unitCost:Number(i.unit_cost),receivedQty:Number(i.received_qty)}))})),
    batches:batches.results.map((x:any)=>({id:x.id,productId:x.product_id,qty:Number(x.qty),unitCost:Number(x.unit_cost),expiry:relationalDate(x.expiry),received:relationalDate(x.received),supplierId:x.supplier_id,invoice:x.invoice,dueDate:optionalRelationalDate(x.due_date),paid:Boolean(x.paid),paidAt:optionalRelationalDate(x.paid_at),payments:(paymentsByBatch.get(x.id)||[]).map((p:any)=>({id:p.id,date:relationalDate(p.date),amount:Number(p.amount),note:p.note}))})),
    stockAdjustments:adjustments.results.map((x:any)=>({id:x.id,batchId:x.batch_id,delta:Number(x.delta),date:relationalDate(x.date),reason:x.reason})),
    inventoryHolds:holds.results.map((x:any)=>({id:x.id,batchId:x.batch_id,qty:Number(x.qty),date:relationalDate(x.date),type:x.type,reason:x.reason,source:x.source,sourceOrderId:x.source_order_id||undefined,releasedAt:optionalRelationalDate(x.released_at)}))
  };
  const parsed=stateSchema.pick({products:true,productCategories:true,suppliers:true,purchaseOrders:true,batches:true,stockAdjustments:true,inventoryHolds:true,returnInspections:true}).parse(data);
  return {data:parsed,version:row.version,domainVersion};
}

export async function saveInventorySupplierDomain(ownerId:string,input:unknown,expectedDomainVersion:number,actor:Actor){
  if(!Number.isInteger(expectedDomainVersion)||expectedDomainVersion<0)throw new Error('DOMAIN_VERSION_REQUIRED');
  const parsed=stateSchema.pick({
    products:true,productCategories:true,suppliers:true,purchaseOrders:true,batches:true,stockAdjustments:true,inventoryHolds:true,returnInspections:true
  }).safeParse(input);
  if(!parsed.success)throw new Error('INVALID_INVENTORY_SUPPLIER_DATA');
  const {row,state}=await ensureInventorySupplierApiReady(ownerId);
  if(parsed.data.returnInspections.length!==state.returnInspections.length||parsed.data.returnInspections.some(r=>JSON.stringify(r)!==JSON.stringify(state.returnInspections.find(p=>p.id===r.id))))throw new Error('Use return inspection to record its history.');
  const currentDomainVersion=await getDomainVersion(ownerId,INVENTORY_SUPPLIER_DOMAIN);
  if(currentDomainVersion!==expectedDomainVersion)throw new Error('DOMAIN_VERSION_CONFLICT');
  const candidate=structuredClone(visibleState(state,actor.role));
  for(const key of inventorySupplierKeys)(candidate[key] as any)=parsed.data[key] as any;
  let next:State;
  try{next=fixedBusinessName(applyRoleChanges(state,candidate,actor.role));}catch(error){throw new Error(error instanceof Error?error.message:'ROLE_FORBIDDEN')}
  for(const before of state.inventoryHolds){if(before.source!=='Return'||!before.sourceOrderId)continue;const after=next.inventoryHolds.find(h=>h.id===before.id);if(!after)throw new Error('Returned-stock history cannot be deleted.');const cost=state.batches.find(b=>b.id===before.batchId)?.unitCost||0,beforeLoss=before.type==='Damaged'&&!before.releasedAt?before.qty*cost:0,afterLoss=after.type==='Damaged'&&!after.releasedAt?after.qty*cost:0,delta=afterLoss-beforeLoss;if(delta)next.returnInspections.push({id:uid(),orderId:before.sourceOrderId,date:today(),outcome:after.type,event:delta>0?'Written off':'Recovered',amount:Math.abs(delta)});}
  validateWorkspaceChange(state,next,{allowInspections:true});validateRelations(next,{skipOrderNumberUniqueness:true});
  const changed=inventorySupplierKeys.filter(key=>JSON.stringify(state[key])!==JSON.stringify(next[key]));
  if(!changed.length)return {data:inventorySupplierData(state),version:row.version,domainVersion:currentDomainVersion};
  const previousBatches=new Map(state.batches.map(b=>[b.id,b]));
  const supplierNames=new Map([...state.suppliers,...next.suppliers].map(s=>[s.id,s.name]));
  const supplierLinks=next.batches.flatMap(batch=>{
    const before=previousBatches.get(batch.id);
    if(!before||(before.supplierId===batch.supplierId&&before.invoice===batch.invoice))return [];
    const name=(id:string)=>supplierNames.get(id)||id||'No supplier';
    return [batch.id+': '+name(before.supplierId)+' / '+before.invoice+' → '+name(batch.supplierId)+' / '+batch.invoice];
  });
  const auditSummary='Updated '+changed.join(', ')+(supplierLinks.length?' · Supplier links: '+supplierLinks.join('; '):'');
  const now=new Date().toISOString(),db=database(),nextVersion=row.version+1;
  await ensureAudit();
  await db.batch([
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(next),now,ownerId,row.version),
    db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END").bind(ownerId,nextVersion,now),
    ...inventorySupplierShadowStatements(ownerId,next,nextVersion,now),
    ...domainVersionBumpStatements(ownerId,INVENTORY_SUPPLIER_DOMAIN,expectedDomainVersion,now),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,auditSummary,JSON.stringify(changed),now)
  ]);
  return {data:inventorySupplierData(next),version:nextVersion,domainVersion:expectedDomainVersion+1};
}

export async function markInventorySupplierShadowStale(ownerId:string,sourceVersion:number){
  const now=new Date().toISOString();
  await database().prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=NULL,updated_at=EXCLUDED.updated_at')
    .bind(ownerId,INVENTORY_SUPPLIER_DOMAIN,'stale',sourceVersion,null,null,now).run();
}

