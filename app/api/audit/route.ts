import { getAppUser } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { roleCanViewAudit } from '@/lib/roles';
import { parsePageRequest,pageMetadata,literalLike } from '@/lib/pagination';

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
    const page=parsePageRequest(request.url);
    if(page){
      const section=url.searchParams.get('section')||'All';if(section.length>100)return response({error:'Invalid activity section.'},400);
      let where='owner_id=?';const binds:unknown[]=[ownerId];
      if(page.q){where+=' AND (actor_name ILIKE ? OR role ILIKE ? OR summary ILIKE ? OR sections ILIKE ?)';binds.push(...Array(4).fill(literalLike(page.q)));}
      if(page.status!=='All'){where+=' AND role=?';binds.push(page.status);}
      if(section!=='All'){where+=' AND sections LIKE ?';binds.push(literalLike(JSON.stringify(section)));}
      const [count,rows,actors,roles,areas,latest]=await Promise.all([
        db.prepare('SELECT COUNT(*) AS n FROM crm_audit_log WHERE '+where).bind(...binds).first<{n:number}>(),
        db.prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE '+where+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...binds,page.pageSize,(page.page-1)*page.pageSize).all<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>(),
        db.prepare('SELECT COUNT(DISTINCT actor_id) AS n FROM crm_audit_log WHERE owner_id=?').bind(ownerId).first<{n:number}>(),
        db.prepare('SELECT DISTINCT role FROM crm_audit_log WHERE owner_id=? ORDER BY role').bind(ownerId).all<{role:string}>(),
        db.prepare('SELECT DISTINCT jsonb_array_elements_text(sections::jsonb) AS section FROM crm_audit_log WHERE owner_id=? ORDER BY section').bind(ownerId).all<{section:string}>(),
        db.prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(ownerId).first<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>()
      ]);
      return response({events:rows.results.map(r=>({...r,sections:JSON.parse(r.sections)})),pagination:pageMetadata(page,Number(count?.n||0)),actorCount:Number(actors?.n||0),roles:roles.results.map(r=>r.role),sections:areas.results.map(r=>r.section),latest:latest?{...latest,sections:JSON.parse(latest.sections)}:null});
    }
    const rows=await db.prepare('SELECT id,actor_name,role,summary,sections,created_at FROM crm_audit_log WHERE owner_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(ownerId,limit+1,offset).all<{id:string;actor_name:string;role:string;summary:string;sections:string;created_at:string}>();
    const hasMore=rows.results.length>limit;
    const events=rows.results.slice(0,limit).map(r=>({...r,sections:JSON.parse(r.sections)}));
    return response({events,hasMore,nextOffset:offset+events.length});
  }catch(e){
    if(e instanceof Error&&e.message==='Invalid pagination.')return response({error:e.message},400);
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Audit log read failed',e);
    return response({error:'Could not load activity history.'},503);
  }
}
