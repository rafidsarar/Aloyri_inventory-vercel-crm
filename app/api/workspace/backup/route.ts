import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { fixedBusinessName, stateSchema, validateRelations, workspaceIntegrityWarnings, type State } from '@/lib/crm';
import { roleCanBackup } from '@/lib/roles';
import { relationalCoreState,setRelationalCutover,verifyRelationalParity } from '@/db/relational-cutover';
import { migrateCustomersOrdersShadow,CUSTOMER_ORDER_DOMAIN } from '@/db/customer-order-shadow';
import { migrateInventorySupplierShadow,INVENTORY_SUPPLIER_DOMAIN } from '@/db/inventory-supplier-shadow';
import { migrateFinanceShadow,FINANCE_DOMAIN } from '@/db/finance-shadow';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

const recordCounts=(data:State)=>({
  products:data.products.length,
  customers:data.customers.length,
  suppliers:data.suppliers.length,
  purchaseOrders:data.purchaseOrders.length,
  batches:data.batches.length,
  orders:data.orders.length,
  expenses:data.expenses.length,
  cashEntries:data.cashEntries.length,
  tasks:data.tasks.length,
  inventoryHolds:data.inventoryHolds.length,
  stockAdjustments:data.stockAdjustments.length,
  accountOpenings:data.accountOpenings.length,
  accountMatches:data.accountMatches.length,
  financeCloses:data.financeCloses.length
});

async function sha256(data:unknown){
  const bytes=new TextEncoder().encode(JSON.stringify(data));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

async function parseBackup(backup:any){
  if(backup?.format!=='aloyri-workspace-backup'||![1,2,3,4].includes(backup?.schemaVersion))
    throw new Error('This is not a supported ALOYRI workspace backup.');
  const rawChecksum=await sha256(backup.data);
  if(backup.schemaVersion>=2){
    if(backup?.integrity?.algorithm!=='SHA-256'||typeof backup?.integrity?.checksum!=='string')
      throw new Error('Backup integrity metadata is missing.');
    if(backup.integrity.checksum!==rawChecksum)throw new Error('Backup integrity check failed. The file may be incomplete or modified.');
  }
  const restored=fixedBusinessName(stateSchema.parse(backup.data));
  validateRelations(restored,{skipOrderNumberUniqueness:true});
  const counts=recordCounts(restored);
  if(backup.schemaVersion>=2&&backup.integrity.counts&&Object.entries(counts).some(([key,value])=>backup.integrity.counts[key]!==value))
    throw new Error('Backup record counts do not match the file contents.');
  if(backup.schemaVersion>=3&&!backup.integrity.counts)throw new Error('Backup record-count metadata is missing.');
  return {restored,counts,checksum:rawChecksum,warnings:workspaceIntegrityWarnings(restored)};
}

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanBackup(role))return response({error:'Only the business owner can create a full backup.'},403);
    const row=await database().prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
    if(!row)return response({error:'Workspace not found.'},404);
    const {state:data}=await relationalCoreState(ownerId);
    validateRelations(data,{skipOrderNumberUniqueness:true});
    const counts=recordCounts(data),checksum=await sha256(data),verification=await verifyRelationalParity(ownerId);
    return response({
      format:'aloyri-workspace-backup',
      schemaVersion:4,
      source:'relational-core+compatibility',
      createdAt:new Date().toISOString(),
      workspaceVersion:row.version,
      workspaceUpdatedAt:row.updated_at,
      integrity:{algorithm:'SHA-256',checksum,counts,relationsValidated:true,relationalParity:verification,warnings:workspaceIntegrityWarnings(data)},
      data
    });
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Backup creation failed',e);
    return response({error:'Could not create backup.'},503);
  }
}

export async function POST(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanBackup(role))return response({error:'Only the business owner can validate or restore a backup.'},403);
    const text=await request.text();
    if(text.length>1900000)return response({error:'Backup is too large.'},413);
    let body:any;
    try{body=JSON.parse(text)}catch{return response({error:'Invalid backup JSON.'},400)}
    const {restored,counts,checksum,warnings}=await parseBackup(body?.backup);
    if(body?.action==='validate'){
      const current=await database().prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
      let currentWorkspace:null|{version:number;updatedAt:string;counts:ReturnType<typeof recordCounts>;checksum:string}=null;
      if(current){
        const currentData=(await relationalCoreState(ownerId)).state;
        currentWorkspace={version:current.version,updatedAt:current.updated_at,counts:recordCounts(currentData),checksum:await sha256(currentData)};
      }
      return response({
        ok:true,
        valid:true,
        schemaVersion:body.backup.schemaVersion,
        createdAt:body.backup.createdAt||null,
        workspaceVersion:body.backup.workspaceVersion??null,
        backupWorkspace:{counts,checksum,warnings},
        currentWorkspace,
        integrity:{checksum,counts,warnings}
      });
    }
    if(body?.action!=='restore'||body?.confirmation!=='RESTORE ALOYRI')
      return response({error:'Type RESTORE ALOYRI to confirm.'},400);
    const db=database();
    const row=await db.prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
    if(!row)return response({error:'Workspace not found.'},404);
    const now=new Date().toISOString(),snapshotId=crypto.randomUUID();
    const currentData=(await relationalCoreState(ownerId)).state,currentChecksum=await sha256(currentData);
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_restore_snapshots (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, workspace_version INTEGER NOT NULL, workspace_updated_at TEXT NOT NULL, checksum TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_restore_snapshots_owner_created_idx ON crm_restore_snapshots(owner_id,created_at DESC)').run();
    await db.prepare('INSERT INTO crm_restore_snapshots (id,owner_id,workspace_version,workspace_updated_at,checksum,data,created_at) VALUES (?,?,?,?,?,?,?)').bind(snapshotId,ownerId,row.version,row.updated_at,currentChecksum,JSON.stringify(currentData),now).run();
    await db.prepare('DELETE FROM crm_restore_snapshots WHERE owner_id=? AND id NOT IN (SELECT id FROM crm_restore_snapshots WHERE owner_id=? ORDER BY created_at DESC LIMIT 5)').bind(ownerId,ownerId).run();
    await setRelationalCutover(ownerId,false,user.displayName||user.email);
    const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(restored),now,ownerId,row.version).run();
    if(!result.meta.changes)return response({error:'Workspace changed while restoring. Try again.'},409);
    const restoredVersion=row.version+1;
    await migrateCustomersOrdersShadow(ownerId,restored,restoredVersion);
    await migrateInventorySupplierShadow(ownerId,restored,restoredVersion);
    await migrateFinanceShadow(ownerId,restored,restoredVersion);
    await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id,domain) DO UPDATE SET version=crm_domain_versions.version+1,updated_at=EXCLUDED.updated_at').bind(ownerId,CUSTOMER_ORDER_DOMAIN,now).run();
    await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id,domain) DO UPDATE SET version=crm_domain_versions.version+1,updated_at=EXCLUDED.updated_at').bind(ownerId,INVENTORY_SUPPLIER_DOMAIN,now).run();
    await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id,domain) DO UPDATE SET version=crm_domain_versions.version+1,updated_at=EXCLUDED.updated_at').bind(ownerId,FINANCE_DOMAIN,now).run();
    const parity=await verifyRelationalParity(ownerId);
    if(!parity.ok)throw new Error('Restore completed but relational verification failed. Cutover remains disabled.');
    await setRelationalCutover(ownerId,true,user.displayName||user.email);
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
    await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,user.userId,user.displayName||user.email,role,'Restored validated workspace backup · safety snapshot '+snapshotId.slice(0,8),JSON.stringify(['backup restore']),now).run();
    return response({ok:true,version:row.version+1,safetySnapshot:{id:snapshotId,checksum:currentChecksum},integrity:{checksum,counts,warnings},relationalParity:parity,cutoverEnabled:true});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Backup validation/restore failed',e);
    return response({error:e instanceof Error?e.message:'Could not validate or restore backup.'},400);
  }
}
