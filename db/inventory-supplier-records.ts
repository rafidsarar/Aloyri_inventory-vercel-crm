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
  const {row,state}=await ensureInventorySupplierApiReady(ownerId);
  return {data:inventorySupplierData(state),version:row.version};
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
