import { database } from '@/db/raw';
import { checkOrigin,clearCookie,newSalt,normalizeEmail,passwordHash,passwordValid,tokenHash } from '@/app/local-auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){try{
 if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);const text=await request.text();if(text.length>4096)return reply({error:'Invalid request.'},400);let body;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
 const email=typeof body.email==='string'?normalizeEmail(body.email):'',code=typeof body.code==='string'?body.code.trim().toLowerCase():'';
 if(email.length>254||!email||!passwordValid(body.password))return reply({error:'Use a valid email and a password of 12–128 characters.'},400);
 const db=database(),now=new Date().toISOString(),keys=await Promise.all(['recovery-email:'+email,'recovery-ip:'+(request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')].map(tokenHash));
 for(const key of keys){const a=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(key).first<{attempts:number;expires_at:string}>();if(a&&a.expires_at>now&&a.attempts>=8)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);}
 await db.batch(keys.map(key=>db.prepare('INSERT INTO crm_login_attempts AS a (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN a.expires_at<=? THEN 1 ELSE a.attempts+1 END,expires_at=EXCLUDED.expires_at').bind(key,new Date(Date.now()+900000).toISOString(),now)));
 const hash=await tokenHash(code),record=await db.prepare('SELECT u.id FROM crm_users u JOIN crm_recovery_codes c ON c.user_id=u.id WHERE u.email=? AND u.active=1 AND c.token_hash=?').bind(email,hash).first<{id:string}>();
 if(!/^[a-f0-9]{64}$/.test(code)||!record){await passwordHash(body.password,'00000000000000000000000000000000');return reply({error:'Email or recovery code is invalid or already used.'},400);}
 const salt=newSalt(),password=await passwordHash(body.password,salt);
 try{await db.batch([db.prepare('SELECT token_hash FROM crm_recovery_codes WHERE token_hash=? AND user_id=? FOR UPDATE').bind(hash,record.id),db.prepare('SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM crm_recovery_codes c JOIN crm_users u ON u.id=c.user_id WHERE c.token_hash=? AND c.user_id=? AND u.active=1) THEN 1 ELSE 0 END').bind(hash,record.id),db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=? AND active=1').bind(salt,password,record.id),db.prepare('DELETE FROM crm_recovery_codes WHERE token_hash=? AND user_id=?').bind(hash,record.id),db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(record.id),db.prepare('DELETE FROM crm_invites WHERE user_id=?').bind(record.id),db.prepare('DELETE FROM crm_login_attempts WHERE key=?').bind(keys[0])]);}catch(e){if(e instanceof Error&&/division by zero/i.test(e.message))return reply({error:'Email or recovery code is invalid or already used.'},400);throw e;}
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':clearCookie(request)}});
 }catch{return reply({error:'Could not recover the account. Try again.'},503);}}
