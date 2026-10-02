import { database } from '@/db/raw';
import { checkOrigin, clearCookie, cleanupAuthState, getAppUser, newSalt, passwordHash, passwordValid, recordSecurityEvent, tokenHash, verifyPassword } from '@/app/local-auth';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});
  const text=await request.text();if(text.length>8192)return Response.json({error:'Invalid request.'},{status:413});
  let body:any;try{body=JSON.parse(text)}catch{return Response.json({error:'Invalid request.'},{status:400})}
  if(typeof body.current!=='string'||!passwordValid(body.next))return Response.json({error:'New password must be 12–128 characters.'},{status:400});
  const db=database();await cleanupAuthState();
  const limiterKey=await tokenHash('password-change:'+user.userId),now=new Date().toISOString();
  const attempt=await db.prepare('SELECT attempts,expires_at FROM crm_login_attempts WHERE key=?').bind(limiterKey).first<{attempts:number;expires_at:string}>();
  if(attempt&&attempt.expires_at>now&&attempt.attempts>=5)return Response.json({error:'Too many password attempts. Try again in 15 minutes.'},{status:429});
  const record=await db.prepare('SELECT password_salt,password_hash FROM crm_users WHERE id=?').bind(user.userId).first<{password_salt:string;password_hash:string}>();
  if(!record||!await verifyPassword(body.current,record.password_salt,record.password_hash)){
    const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
    await db.prepare('INSERT INTO crm_login_attempts AS attempts_row (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN attempts_row.expires_at<=? THEN 1 ELSE attempts_row.attempts+1 END,expires_at=EXCLUDED.expires_at').bind(limiterKey,expiresAt,now).run();
    await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'auth.password_failed'});
    return Response.json({error:'Current password is incorrect.'},{status:403});
  }
  await db.prepare('DELETE FROM crm_login_attempts WHERE key=?').bind(limiterKey).run();
  const salt=newSalt();await db.batch([db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=?').bind(salt,await passwordHash(body.next,salt),user.userId),db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(user.userId)]);
  await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'auth.password_changed'});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':clearCookie(request)}});
}
