import { database } from '@/db/raw';
import { checkOrigin, cleanupAuthState, createSession, normalizeEmail, passwordHash, recordSecurityEvent, verifyPassword } from '@/app/local-auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  const text=await request.text();if(text.length>4096)return reply({error:'Invalid request.'},413);
  let body:any;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  const email=typeof body.email==='string'?normalizeEmail(body.email):'';
  const password=typeof body.password==='string'?body.password:'';
  if(email.length>254||password.length>128||!email||!password)return reply({error:'Invalid email or password.'},401);
  const db=database();
  await cleanupAuthState();
  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientAddress=forwarded||request.headers.get('x-real-ip')||request.headers.get('cf-connecting-ip')||'unknown';
  const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email+':'+clientAddress));
  const attemptKey=Array.from(new Uint8Array(key),x=>x.toString(16).padStart(2,'0')).join('');
  const now=new Date().toISOString();
  const attempt=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(attemptKey).first<{attempts:number;expires_at:string}>();
  if(attempt&&attempt.expires_at>now&&attempt.attempts>=8)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
  const user=await db.prepare('SELECT id,owner_id,password_salt,password_hash FROM crm_users WHERE email=? AND active=1').bind(email).first<{id:string;owner_id:string;password_salt:string|null;password_hash:string|null}>();
  // Keep verification work comparable when the email does not exist.
  const valid=user?.password_salt&&user.password_hash?await verifyPassword(password,user.password_salt,user.password_hash):await (async()=>{await passwordHash(password,'00000000000000000000000000000000');return false})();
  if(!valid){const expiresAt=new Date(Date.now()+15*60*1000).toISOString();await db.prepare('INSERT INTO crm_login_attempts AS attempts_row (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN attempts_row.expires_at<=? THEN 1 ELSE attempts_row.attempts+1 END,expires_at=EXCLUDED.expires_at').bind(attemptKey,expiresAt,now).run();if(user)await recordSecurityEvent({ownerId:user.owner_id,userId:user.id,type:'auth.login_failed'});return reply({error:'Invalid email or password.'},401)}
  await db.prepare('DELETE FROM crm_login_attempts WHERE key=?').bind(attemptKey).run();
  await recordSecurityEvent({ownerId:user!.owner_id,userId:user!.id,type:'auth.login_success'});
  return reply({ok:true},200,{'Set-Cookie':await createSession(request,user!.id)});
}
