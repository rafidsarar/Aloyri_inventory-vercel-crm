import { database } from '@/db/raw';
import { checkOrigin, normalizeEmail, randomToken, tokenHash } from '@/app/local-auth';
import { ensurePasswordResetSchema, passwordResetEmailConfigured, sendPasswordResetEmail } from '@/app/password-reset-server';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const generic={ok:true,message:'If an active ALOYRI account exists for that email, a password reset link has been sent.'};

async function rateKey(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}

export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  if(!passwordResetEmailConfigured())return reply({error:'Password recovery email is not configured yet. Contact the workspace owner.'},503);
  const text=await request.text();if(text.length>4096)return reply({error:'Invalid request.'},413);
  let body:any;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  const email=typeof body.email==='string'?normalizeEmail(body.email):'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(generic);

  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientAddress=forwarded||request.headers.get('x-real-ip')||request.headers.get('cf-connecting-ip')||'unknown';
  const key=await rateKey(`password-reset:${email}:${clientAddress}`);
  const db=database(),now=new Date().toISOString();
  const attempt=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(key).first<{attempts:number;expires_at:string}>();
  if(attempt&&attempt.expires_at>now&&attempt.attempts>=5)return reply({error:'Too many password reset requests. Try again in 15 minutes.'},429);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  await db.prepare('INSERT INTO crm_login_attempts AS attempts_row (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN attempts_row.expires_at<=? THEN 1 ELSE attempts_row.attempts+1 END,expires_at=EXCLUDED.expires_at').bind(key,expiresAt,now).run();

  await ensurePasswordResetSchema();
  const user=await db.prepare('SELECT id,email FROM crm_users WHERE email=? AND active=1').bind(email).first<{id:string;email:string}>();
  if(!user)return reply(generic);

  const token=randomToken(),hash=await tokenHash(token);
  await db.batch([
    db.prepare('DELETE FROM crm_password_resets WHERE user_id=?').bind(user.id),
    db.prepare('INSERT INTO crm_password_resets (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,user.id,new Date(Date.now()+30*60*1000).toISOString(),now),
  ]);
  try{
    const resetUrl=new URL('/reset-password?token='+token,request.url).toString();
    await sendPasswordResetEmail(user.email,resetUrl);
  }catch(error){
    console.error('Password reset email failed',error);
    await db.prepare('DELETE FROM crm_password_resets WHERE token_hash=?').bind(hash).run();
  }
  return reply(generic);
}
