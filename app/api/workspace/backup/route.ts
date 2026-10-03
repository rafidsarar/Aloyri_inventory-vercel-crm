import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { validateRelations, workspaceIntegrityWarnings, type State } from '@/lib/crm';
import { roleCanBackup } from '@/lib/roles';
import { relationalCoreState,verifyRelationalParity } from '@/db/relational-cutover';
import { customerOrderShadowStatements,CUSTOMER_ORDER_DOMAIN } from '@/db/customer-order-shadow';
import { inventorySupplierShadowStatements,INVENTORY_SUPPLIER_DOMAIN } from '@/db/inventory-supplier-shadow';
import { financeShadowStatements,FINANCE_DOMAIN } from '@/db/finance-shadow';
import { getDomainVersion,domainVersionBumpStatements } from '@/db/domain-version';
import { canonicalizeLegacyState } from '@/lib/data-integrity';

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
  customerRefunds:data.customerRefunds.length,
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
  const {state:restored}=canonicalizeLegacyState(backup.data);
  const counts=recordCounts(restored);
  if(backup.schemaVersion>=2&&backup.integrity.counts&&Object.entries(counts).some(([key,value])=>(key==='customerRefunds'&&backup.integrity.counts[key]===undefined&&value===0?false:backup.integrity.counts[key]!==value)))
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
    if(body?.action==='recordExport'){
      const current=(await relationalCoreState(ownerId)).state;
      validateRelations(current,{skipOrderNumberUniqueness:true});
      const counts=recordCounts(current),checksum=await sha256(current),parity=await verifyRelationalParity(ownerId);
      await database().prepare('INSERT INTO crm_backup_events (id,owner_id,actor_id,checksum,record_counts,relational_parity_ok,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),ownerId,user.userId,checksum,JSON.stringify(counts),parity.ok?1:0,new Date().toISOString()).run();
      return response({ok:true,checksum,counts,relationalParity:parity});
    }
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
    const now=new Date().toISOString(),snapshotId=crypto.randomUUID(),auditId=crypto.randomUUID();
    const restoredVersion=row.version+1;
    const currentData=(await relationalCoreState(ownerId)).state,currentChecksum=await sha256(currentData);
    const [customerOrderVersion,inventoryVersion,financeVersion]=await Promise.all([
      getDomainVersion(ownerId,CUSTOMER_ORDER_DOMAIN),
      getDomainVersion(ownerId,INVENTORY_SUPPLIER_DOMAIN),
      getDomainVersion(ownerId,FINANCE_DOMAIN)
    ]);
    const actor=user.displayName||user.email;
    const statements:any[]=[
      db.prepare('INSERT INTO crm_restore_snapshots (id,owner_id,workspace_version,workspace_updated_at,checksum,data,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(snapshotId,ownerId,row.version,row.updated_at,currentChecksum,JSON.stringify(currentData),now),
      db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
        .bind(JSON.stringify(restored),now,ownerId,row.version),
      db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END")
        .bind(ownerId,restoredVersion,now),
      ...customerOrderShadowStatements(ownerId,restored,restoredVersion,now),
      ...inventorySupplierShadowStatements(ownerId,restored,restoredVersion,now),
      ...financeShadowStatements(ownerId,restored,restoredVersion,now),
      ...domainVersionBumpStatements(ownerId,CUSTOMER_ORDER_DOMAIN,customerOrderVersion,now),
      ...domainVersionBumpStatements(ownerId,INVENTORY_SUPPLIER_DOMAIN,inventoryVersion,now),
      ...domainVersionBumpStatements(ownerId,FINANCE_DOMAIN,financeVersion,now),
      db.prepare('INSERT INTO crm_relational_cutover (owner_id,enabled,enabled_at,enabled_by,last_verified_at,last_verification,updated_at) VALUES (?,TRUE,?,?,NULL,?,?) ON CONFLICT(owner_id) DO UPDATE SET enabled=TRUE,enabled_at=EXCLUDED.enabled_at,enabled_by=EXCLUDED.enabled_by,last_verified_at=NULL,last_verification=EXCLUDED.last_verification,updated_at=EXCLUDED.updated_at')
        .bind(ownerId,now,actor,JSON.stringify({status:'pending-post-restore-verification',workspaceVersion:restoredVersion}),now),
      db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(auditId,ownerId,user.userId,actor,role,'Restored validated workspace backup · safety snapshot '+snapshotId.slice(0,8),JSON.stringify(['backup restore']),now)
    ];
    await db.batch(statements);
    await db.prepare('DELETE FROM crm_restore_snapshots WHERE owner_id=? AND id NOT IN (SELECT id FROM crm_restore_snapshots WHERE owner_id=? ORDER BY created_at DESC LIMIT 5)').bind(ownerId,ownerId).run();
    const parity=await verifyRelationalParity(ownerId);
    if(!parity.ok){
      await db.prepare('UPDATE crm_relational_cutover SET enabled=FALSE,updated_at=? WHERE owner_id=?').bind(new Date().toISOString(),ownerId).run();
      throw new Error('RESTORE_PARITY_FAILED');
    }
    return response({ok:true,version:restoredVersion,safetySnapshot:{id:snapshotId,checksum:currentChecksum},integrity:{checksum,counts,warnings},relationalParity:parity,cutoverEnabled:true,atomicCommit:true});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Backup validation/restore failed',e);
    if(e instanceof Error&&e.message==='RESTORE_PARITY_FAILED')return response({error:'Restore committed but relational verification failed. Recovery mode is enabled for safety.'},503);
    if(e instanceof Error&&/WORKSPACE_VERSION_CONFLICT|division by zero/i.test(e.message))return response({error:'Workspace changed while restoring. Try again.'},409);
    return response({error:e instanceof Error?e.message:'Could not validate or restore backup.'},400);
  }
}

