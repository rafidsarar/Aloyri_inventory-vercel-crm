import { database } from '@/db/raw';
import { checkOrigin, createSession, newSalt, passwordHash, passwordValid, tokenHash } from '@/app/local-auth';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  let body:any;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||!passwordValid(body.password))return Response.json({error:'Use a valid invitation and a password of 12–128 characters.'},{status:400});
  const db=database(),hash=await tokenHash(body.token);
  const row=await db.prepare('DELETE FROM crm_invites WHERE token_hash=? AND expires_at>? RETURNING user_id').bind(hash,new Date().toISOString()).first<{user_id:string}>();
  if(!row)return Response.json({error:'This invitation expired or was already used. Ask the owner for a new link.'},{status:410});
  const active=await db.prepare('SELECT active FROM crm_users WHERE id=?').bind(row.user_id).first<{active:number}>();if(!active?.active)return Response.json({error:'This account is no longer active.'},{status:410});
  const salt=newSalt(),password=await passwordHash(body.password,salt);
  await db.batch([
    db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=? AND active=1').bind(salt,password,row.user_id),
    db.prepare('DELETE FROM crm_invites WHERE user_id=?').bind(row.user_id),
    db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(row.user_id),
  ]);
  return Response.json({ok:true},{headers:{'Set-Cookie':await createSession(request,row.user_id),'Cache-Control':'no-store'}});
}
