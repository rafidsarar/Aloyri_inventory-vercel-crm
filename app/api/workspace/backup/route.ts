import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { fixedBusinessName, stateSchema, validateRelations, type State } from '@/lib/crm';
import { roleCanBackup } from '@/lib/roles';

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
  stockAdjustments:data.stockAdjustments.length
});

async function sha256(data:State){
  const bytes=new TextEncoder().encode(JSON.stringify(data));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

async function parseBackup(backup:any){
  if(backup?.format!=='aloyri-workspace-backup'||![1,2].includes(backup?.schemaVersion))
    throw new Error('This is not a supported ALOYRI workspace backup.');
  const restored=fixedBusinessName(stateSchema.parse(backup.data));
  validateRelations(restored);
  const counts=recordCounts(restored);
  const checksum=await sha256(restored);
  if(backup.schemaVersion===2){
    if(backup?.integrity?.algorithm!=='SHA-256'||typeof backup?.integrity?.checksum!=='string')
      throw new Error('Backup integrity metadata is missing.');
    if(backup.integrity.checksum!==checksum)throw new Error('Backup integrity check failed. The file may be incomplete or modified.');
    if(backup.integrity.counts&&JSON.stringify(backup.integrity.counts)!==JSON.stringify(counts))
      throw new Error('Backup record counts do not match the file contents.');
  }
  return {restored,counts,checksum};
}

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanBackup(role))return response({error:'Only the business owner can create a full backup.'},403);
    const row=await database().prepare('SELECT data,version,updated_at FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number;updated_at:string}>();
    if(!row)return response({error:'Workspace not found.'},404);
    const data=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
    validateRelations(data);
    const counts=recordCounts(data),checksum=await sha256(data);
    return response({
      format:'aloyri-workspace-backup',
      schemaVersion:2,
      createdAt:new Date().toISOString(),
      workspaceVersion:row.version,
      workspaceUpdatedAt:row.updated_at,
      integrity:{algorithm:'SHA-256',checksum,counts},
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
    const {restored,counts,checksum}=await parseBackup(body?.backup);
    if(body?.action==='validate'){
      return response({
        ok:true,
        valid:true,
        schemaVersion:body.backup.schemaVersion,
        createdAt:body.backup.createdAt||null,
        workspaceVersion:body.backup.workspaceVersion??null,
        integrity:{checksum,counts}
      });
    }
    if(body?.action!=='restore'||body?.confirmation!=='RESTORE ALOYRI')
      return response({error:'Type RESTORE ALOYRI to confirm.'},400);
    const db=database();
    const row=await db.prepare('SELECT version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{version:number}>();
    if(!row)return response({error:'Workspace not found.'},404);
    const now=new Date().toISOString();
    const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(restored),now,ownerId,row.version).run();
    if(!result.meta.changes)return response({error:'Workspace changed while restoring. Try again.'},409);
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
    await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,user.userId,user.displayName||user.email,role,'Restored validated workspace backup',JSON.stringify(['backup restore']),now).run();
    return response({ok:true,version:row.version+1,integrity:{checksum,counts}});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Backup validation/restore failed',e);
    return response({error:e instanceof Error?e.message:'Could not validate or restore backup.'},400);
  }
}
