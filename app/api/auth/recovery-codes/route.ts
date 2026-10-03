import { database } from '@/db/raw';
import { checkOrigin,getAppUser,passwordHash,randomToken,tokenHash,verifyPassword } from '@/app/local-auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);const row=await database().prepare('SELECT COUNT(*) AS n FROM crm_recovery_codes WHERE user_id=?').bind(user.userId).first<{n:number}>();return reply({remaining:Number(row?.n||0)});}catch{return reply({error:'Could not load recovery codes.'},503);}}
export async function POST(request:Request){try{
 if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);
 const text=await request.text();if(text.length>2048)return reply({error:'Invalid request.'},400);let body;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
 if(typeof body.current!=='string'||body.current.length>128)return reply({error:'Enter your current password.'},400);
 const db=database(),now=new Date().toISOString(),key=await tokenHash('recovery-code-generation:'+user.userId),attempt=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(key).first<{attempts:number;expires_at:string}>();
 if(attempt&&attempt.expires_at>now&&attempt.attempts>=5)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
 const record=await db.prepare('SELECT password_salt,password_hash FROM crm_users WHERE id=? AND active=1').bind(user.userId).first<{password_salt:string;password_hash:string}>();
 if(!record||!await verifyPassword(body.current,record.password_salt,record.password_hash)){await db.prepare('INSERT INTO crm_login_attempts AS a (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN a.expires_at<=? THEN 1 ELSE a.attempts+1 END,expires_at=EXCLUDED.expires_at').bind(key,new Date(Date.now()+900000).toISOString(),now).run();return reply({error:'Current password is incorrect.'},403);}
 const codes=Array.from({length:8},()=>randomToken()),hashes=await Promise.all(codes.map(tokenHash));
 await db.batch([db.prepare('SELECT id FROM crm_users WHERE id=? FOR UPDATE').bind(user.userId),db.prepare('SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM crm_users WHERE id=? AND active=1 AND password_hash=?) THEN 1 ELSE 0 END').bind(user.userId,record.password_hash),db.prepare('DELETE FROM crm_recovery_codes WHERE user_id=?').bind(user.userId),...hashes.map(hash=>db.prepare('INSERT INTO crm_recovery_codes(user_id,token_hash,created_at) VALUES (?,?,?)').bind(user.userId,hash,now)),db.prepare('DELETE FROM crm_login_attempts WHERE key=?').bind(key)]);
 return reply({codes});
 }catch{return reply({error:'Could not generate recovery codes. Try again.'},503);}}
