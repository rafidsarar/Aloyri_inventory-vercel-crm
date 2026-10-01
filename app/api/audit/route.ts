import { getAppUser } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { roleCanViewAudit } from '@/lib/roles';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view activity.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewAudit(role))return response({error:'Only the owner or an admin can view the audit log.'},403);
    const url=new URL(request.url);
    const requestedLimit=Number(url.searchParams.get('limit')||200);
    const requestedOffset=Number(url.searchParams.get('offset')||0);
    const limit=Number.isInteger(requestedLimit)?Math.min(300,Math.max(25,requestedLimit)):200;
    const offset=Number.isInteger(requestedOffset)?Math.min(50000,Math.max(0,requestedOffset)):0;
    const db=database();
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
    const rows=await db.prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE owner_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(ownerId,limit+1,offset).all<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>();
    const hasMore=rows.results.length>limit;
    const events=rows.results.slice(0,limit).map(r=>({...r,sections:JSON.parse(r.sections)}));
    return response({events,hasMore,nextOffset:offset+events.length});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Audit log read failed',e);
    return response({error:'Could not load activity history.'},503);
  }
}
