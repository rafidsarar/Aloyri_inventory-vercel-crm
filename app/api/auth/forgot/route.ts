import { database } from '@/db/raw';
import { checkOrigin, normalizeEmail, randomToken, tokenHash } from '@/app/local-auth';
import { passwordResetEmailConfigured, passwordResetExpiry, passwordResetUrl, sendPasswordResetEmail } from '@/lib/password-reset';

export const dynamic='force-dynamic';
const genericMessage='If an active ALOYRI account exists for that email, a reset link will be sent.';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function ensureResetTable(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_password_resets_user ON crm_password_resets(user_id)').run();
}
function clientAddress(request:Request){
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||
    request.headers.get('x-real-ip')||
    request.headers.get('cf-connecting-ip')||
    'unknown';
}

export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  if(!passwordResetEmailConfigured())return reply({error:'Password reset email is temporarily unavailable. Contact your workspace owner.'},503);
  const text=await request.text();
  if(text.length>4096)return reply({error:'Invalid request.'},413);
  let body:any;
  try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  const email=typeof body.email==='string'?normalizeEmail(body.email):'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Enter a valid email address.'},400);

  const db=database();
  await ensureResetTable();
  const now=new Date().toISOString();
  const limitKey=await tokenHash('password-reset:'+email+':'+clientAddress(request));
  const current=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(limitKey).first<{attempts:number;expires_at:string}>();
  if(current&&current.expires_at>now&&current.attempts>=4)return reply({error:'Too many reset requests. Try again later.'},429);
  const limitExpiry=current&&current.expires_at>now?current.expires_at:new Date(Date.now()+30*60*1000).toISOString();
  await db.prepare('INSERT INTO crm_login_attempts AS attempts_row (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN attempts_row.expires_at<=? THEN 1 ELSE attempts_row.attempts+1 END,expires_at=CASE WHEN attempts_row.expires_at<=? THEN EXCLUDED.expires_at ELSE attempts_row.expires_at END').bind(limitKey,limitExpiry,now,now).run();

  const user=await db.prepare('SELECT id,email,name FROM crm_users WHERE email=? AND active=1 AND password_hash IS NOT NULL').bind(email).first<{id:string;email:string;name:string}>();
  if(user){
    const token=randomToken(),hash=await tokenHash(token),expiresAt=passwordResetExpiry(),createdAt=new Date().toISOString();
    await db.prepare('DELETE FROM crm_password_resets WHERE expires_at<=?').bind(now).run();
    await db.prepare('INSERT INTO crm_password_resets (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,user.id,expiresAt,createdAt).run();
    const baseUrl=process.env.PASSWORD_RESET_BASE_URL?.trim()||new URL(request.url).origin;
    try{
      await sendPasswordResetEmail({to:user.email,name:user.name||user.email,resetUrl:passwordResetUrl(baseUrl,token)});
      await db.prepare('DELETE FROM crm_password_resets WHERE user_id=? AND token_hash<>?').bind(user.id,hash).run();
    }catch(error){
      await db.prepare('DELETE FROM crm_password_resets WHERE token_hash=?').bind(hash).run();
      console.error('Password reset delivery failed',error instanceof Error?error.message:'Unknown provider error');
    }
  }
  return reply({ok:true,message:genericMessage},202);
}
