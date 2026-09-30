import { getAppUser } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { roleCanViewAudit } from '@/lib/roles';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view activity.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewAudit(role))return response({error:'Only the owner or an admin can view the audit log.'},403);
    const db=database();
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    const rows=await db.prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE owner_id=? ORDER BY created_at DESC LIMIT 300').bind(ownerId).all<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>();
    return response({events:rows.results.map(r=>({...r,sections:JSON.parse(r.sections)}))});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Audit log read failed',e);
    return response({error:'Could not load activity history.'},503);
  }
}
