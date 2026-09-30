import { getAppUser, checkOrigin, normalizeEmail, randomToken, tokenHash } from '@/app/local-auth';
import { database } from '@/db/raw';
import { roleCanManageTeam } from '@/lib/roles';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function owner(){const user=await getAppUser();if(!user)return {error:response({error:'Sign in to manage staff.'},401)};if(!roleCanManageTeam(user.role))return {error:response({error:'Only the owner can manage staff.'},403)};return {user}}
type StaffRow={id:string;email:string;role:string;password_hash:string|null;created_at:string};
export async function GET(){try{const access=await owner();if(access.error)return access.error;const rows=await database().prepare("SELECT id,email,role,password_hash,created_at FROM crm_users WHERE owner_id=? AND role!='owner' AND active=1 ORDER BY created_at ASC").bind(access.user!.userId).all<StaffRow>();return response({staff:rows.results.map(r=>({email:r.email,role:r.role,joined:!!r.password_hash,created:r.created_at}))})}catch(e){console.error('Team read failed',e);return response({error:'Could not load staff.'},503)}}
export async function POST(request:Request){
  try{
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const access=await owner();if(access.error)return access.error;
    const text=await request.text();if(text.length>2048)return response({error:'Invalid request.'},400);
    let body:any;try{body=JSON.parse(text)}catch{return response({error:'Invalid request.'},400)}
    const email=typeof body.email==='string'?normalizeEmail(body.email):'';
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return response({error:'Enter a valid email address.'},400);
    if(email===access.user!.email)return response({error:'You already own this workspace.'},400);
    const db=database(),existing=await db.prepare('SELECT id,owner_id,role,password_hash FROM crm_users WHERE email=?').bind(email).first<{id:string;owner_id:string;role:string;password_hash:string|null}>();
    if(existing&&existing.owner_id!==access.user!.userId)return response({error:'This email belongs to another workspace.'},409);
    if(body.action==='remove'){
      if(!existing||existing.role==='owner')return response({error:'Staff account not found.'},404);
      await db.batch([db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(existing.id),db.prepare('DELETE FROM crm_invites WHERE user_id=?').bind(existing.id),db.prepare('DELETE FROM crm_users WHERE id=? AND owner_id=?').bind(existing.id,access.user!.userId)]);
      return response({ok:true});
    }
    if(body.action!=='save'&&body.action!=='invite')return response({error:'Invalid action.'},400);
    if(body.action==='save'&&!['admin','sales','inventory','viewer'].includes(body.role))return response({error:'Choose a staff role.'},400);
    if(body.action==='invite'&&(!existing||existing.role==='owner'))return response({error:'Staff account not found.'},404);
    if(!existing){
      const count=await db.prepare("SELECT COUNT(*) AS n FROM crm_users WHERE owner_id=? AND role!='owner'").bind(access.user!.userId).first<{n:number}>();
      if((count?.n||0)>=20)return response({error:'The team limit is 20 people.'},400);
      const id=crypto.randomUUID();await db.prepare('INSERT INTO crm_users (id,owner_id,email,name,role,created_at) VALUES (?,?,?,?,?,?)').bind(id,access.user!.userId,email,'',body.role,new Date().toISOString()).run();
    }else if(body.action==='save')await db.prepare('UPDATE crm_users SET role=? WHERE id=? AND owner_id=?').bind(body.role,existing.id,access.user!.userId).run();
    const id=existing?.id||await db.prepare('SELECT id FROM crm_users WHERE email=?').bind(email).first<{id:string}>().then(r=>r!.id);
    if(existing?.password_hash&&body.action==='save')return response({ok:true});
    const token=randomToken(),hash=await tokenHash(token);
    await db.batch([db.prepare('DELETE FROM crm_invites WHERE user_id=?').bind(id),db.prepare('INSERT INTO crm_invites (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,id,new Date(Date.now()+7*24*60*60*1000).toISOString(),new Date().toISOString())]);
    return response({ok:true,inviteUrl:new URL('/invite?token='+token,request.url).toString()});
  }catch(e){console.error('Team update failed',e);return response({error:'Could not update staff access.'},503)}
}
