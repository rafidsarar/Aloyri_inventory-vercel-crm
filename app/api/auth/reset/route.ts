import { database } from '@/db/raw';
import { checkOrigin, clearCookie, newSalt, passwordHash, passwordValid, tokenHash, verifyPassword } from '@/app/local-auth';
import { passwordResetTokenValid } from '@/lib/password-reset';
import type { WorkspaceRole } from '@/lib/roles';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});

export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  const text=await request.text();
  if(text.length>8192)return reply({error:'Invalid request.'},413);
  let body:any;
  try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  if(!passwordResetTokenValid(body.token)||!passwordValid(body.password))return reply({error:'This reset link is invalid, or the new password is not 12–128 characters.'},400);

  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  const hash=await tokenHash(body.token),now=new Date().toISOString();
  const record=await db.prepare('SELECT r.user_id,u.owner_id,u.email,u.name,u.role,u.password_salt,u.password_hash FROM crm_password_resets r JOIN crm_users u ON u.id=r.user_id WHERE r.token_hash=? AND r.expires_at>? AND u.active=1 AND u.password_hash IS NOT NULL').bind(hash,now).first<{user_id:string;owner_id:string;email:string;name:string;role:WorkspaceRole;password_salt:string;password_hash:string}>();
  if(!record)return reply({error:'This password reset link expired or was already used. Request a new one.'},410);
  if(await verifyPassword(body.password,record.password_salt,record.password_hash))return reply({error:'Choose a new password that is different from your current password.'},400);

  const salt=newSalt(),nextHash=await passwordHash(body.password,salt);
  const consumed=await db.prepare('DELETE FROM crm_password_resets WHERE token_hash=? AND expires_at>? RETURNING user_id').bind(hash,now).first<{user_id:string}>();
  if(!consumed||consumed.user_id!==record.user_id)return reply({error:'This password reset link expired or was already used. Request a new one.'},410);

  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.batch([
    db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=? AND active=1').bind(salt,nextHash,record.user_id),
    db.prepare('DELETE FROM crm_password_resets WHERE user_id=?').bind(record.user_id),
    db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(record.user_id),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),record.owner_id,record.user_id,record.name||record.email,record.role,'Reset account password',JSON.stringify(['security']),now)
  ]);
  return reply({ok:true,message:'Password updated. Sign in again with your new password.'},200,{'Set-Cookie':clearCookie(request)});
}
