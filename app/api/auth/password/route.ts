import { database } from '@/db/raw';
import { checkOrigin, clearCookie, getAppUser, newSalt, passwordHash, passwordValid, verifyPassword } from '@/app/local-auth';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});
  const text=await request.text();if(text.length>8192)return Response.json({error:'Invalid request.'},{status:413});
  let body:any;try{body=JSON.parse(text)}catch{return Response.json({error:'Invalid request.'},{status:400})}
  if(typeof body.current!=='string'||!passwordValid(body.next))return Response.json({error:'New password must be 12–128 characters.'},{status:400});
  const db=database();const record=await db.prepare('SELECT password_salt,password_hash FROM crm_users WHERE id=?').bind(user.userId).first<{password_salt:string;password_hash:string}>();
  if(!record||!await verifyPassword(body.current,record.password_salt,record.password_hash))return Response.json({error:'Current password is incorrect.'},{status:403});
  const salt=newSalt();await db.batch([db.prepare('UPDATE crm_users SET password_salt=?,password_hash=? WHERE id=?').bind(salt,await passwordHash(body.next,salt),user.userId),db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(user.userId)]);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':clearCookie(request)}});
}
