import { database } from '@/db/raw';
import { checkOrigin, newSalt, passwordHash, passwordValid, tokenHash } from '@/app/local-auth';
import { ensurePasswordResetSchema } from '@/app/password-reset-server';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  const text=await request.text();if(text.length>8192)return reply({error:'Invalid request.'},413);
  let body:any;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||!passwordValid(body.password))return reply({error:'Use a valid reset link and a password of 12–128 characters.'},400);
  await ensurePasswordResetSchema();
  const db=database(),hash=await tokenHash(body.token);
  const row=await db.prepare('DELETE FROM crm_password_resets WHERE token_hash=? AND expires_at>? RETURNING user_id').bind(hash,new Date().toISOString()).first<{user_id:string}>();
  if(!row)return reply({error:'This password reset link expired or was already used.'},410);
  const active=await db.prepare('SELECT active FROM crm_users WHERE id=?').bind(row.user_id).first<{active:number}>();
  if(!active?.active)return reply({error:'This account is no longer active.'},410);
  const salt=newSalt(),password=await passwordHash(body.password,salt);
  await db.batch([
    db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=? AND active=1').bind(salt,password,row.user_id),
    db.prepare('DELETE FROM crm_password_resets WHERE user_id=?').bind(row.user_id),
    db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(row.user_id),
  ]);
  return reply({ok:true});
}
