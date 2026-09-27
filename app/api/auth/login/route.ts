import { database } from '@/db/raw';
import { checkOrigin, createSession, normalizeEmail, passwordHash, verifyPassword } from '@/app/local-auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  let body:any;try{body=await request.json()}catch{return reply({error:'Invalid request.'},400)}
  const email=typeof body.email==='string'?normalizeEmail(body.email):'';
  const password=typeof body.password==='string'?body.password:'';
  if(email.length>254||password.length>128||!email||!password)return reply({error:'Invalid email or password.'},401);
  const db=database();
  const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email+':'+(request.headers.get('cf-connecting-ip')||'local')));
  const attemptKey=Array.from(new Uint8Array(key),x=>x.toString(16).padStart(2,'0')).join('');
  const now=new Date().toISOString();
  const attempt=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(attemptKey).first<{attempts:number;expires_at:string}>();
  if(attempt&&attempt.expires_at>now&&attempt.attempts>=8)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
  const user=await db.prepare('SELECT id,password_salt,password_hash FROM crm_users WHERE email=? AND active=1').bind(email).first<{id:string;password_salt:string|null;password_hash:string|null}>();
  // Keep verification work comparable when the email does not exist.
  const valid=user?.password_salt&&user.password_hash?await verifyPassword(password,user.password_salt,user.password_hash):await (async()=>{await passwordHash(password,'00000000000000000000000000000000');return false})();
  if(!valid){await db.prepare('INSERT INTO crm_login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=?').bind(attemptKey,new Date(Date.now()+15*60*1000).toISOString(),now,new Date(Date.now()+15*60*1000).toISOString()).run();return reply({error:'Invalid email or password.'},401)}
  await db.prepare('DELETE FROM crm_login_attempts WHERE key=?').bind(attemptKey).run();
  return reply({ok:true},200,{'Set-Cookie':await createSession(request,user!.id)});
}
