import { getAppUser } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { verifyRelationalParity } from '@/db/relational-cutover';
import { roleCanBackup } from '@/lib/roles';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();if(!user)return reply({error:'Please sign in.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanBackup(role))return reply({error:'Only the business owner can view recovery readiness.'},403);
    const db=database();
    const [backup,snapshot,cutover,parity]=await Promise.all([
      db.prepare('SELECT created_at,checksum,record_counts,relational_parity_ok FROM crm_backup_events WHERE owner_id=? ORDER BY created_at DESC LIMIT 1')
        .bind(ownerId).first<{created_at:string;checksum:string;record_counts:string;relational_parity_ok:number}>(),
      db.prepare('SELECT created_at,checksum,workspace_version FROM crm_restore_snapshots WHERE owner_id=? ORDER BY created_at DESC LIMIT 1')
        .bind(ownerId).first<{created_at:string;checksum:string;workspace_version:number}>(),
      db.prepare('SELECT enabled,last_verified_at,updated_at FROM crm_relational_cutover WHERE owner_id=?')
        .bind(ownerId).first<{enabled:boolean;last_verified_at:string|null;updated_at:string}>(),
      verifyRelationalParity(ownerId)
    ]);
    const backupAgeHours=backup?Math.max(0,(Date.now()-Date.parse(backup.created_at))/3600000):null;
    const checks={
      recentBackup:Boolean(backup&&backupAgeHours!==null&&backupAgeHours<=168&&backup.relational_parity_ok===1),
      relationalParity:parity.ok,
      cutoverEnabled:Boolean(cutover?.enabled),
      safetySnapshotAvailable:Boolean(snapshot)
    };
    return reply({
      status:checks.recentBackup&&checks.relationalParity&&checks.cutoverEnabled?'ready':'attention',
      checks,
      latestBackup:backup?{
        createdAt:backup.created_at,
        ageHours:Math.round((backupAgeHours||0)*10)/10,
        checksum:backup.checksum,
        counts:JSON.parse(backup.record_counts||'{}'),
        relationalParityOk:backup.relational_parity_ok===1
      }:null,
      latestSafetySnapshot:snapshot?{createdAt:snapshot.created_at,checksum:snapshot.checksum,workspaceVersion:snapshot.workspace_version}:null
    });
  }catch(e){
    if(e instanceof AccessDenied)return reply({error:e.message},403);
    console.error('Recovery readiness failed',e);
    return reply({error:'Could not check recovery readiness.'},503);
  }
}
