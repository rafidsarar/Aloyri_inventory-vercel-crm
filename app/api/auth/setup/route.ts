import { database } from '@/db/raw';
import { checkOrigin, createSession, newSalt, normalizeEmail, passwordHash, passwordValid } from '@/app/local-auth';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  let body:any;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
  const email=typeof body.email==='string'?normalizeEmail(body.email):'';
  if(!process.env.BOOTSTRAP_SECRET||process.env.BOOTSTRAP_SECRET==='replace-with-a-random-private-setup-key'||typeof body.secret!=='string'||body.secret.length>256||body.secret!==process.env.BOOTSTRAP_SECRET)return Response.json({error:'Setup key is incorrect.'},{status:403});
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!passwordValid(body.password))return Response.json({error:'Use a valid email and a password of 12–128 characters.'},{status:400});
  const db=database(),id=crypto.randomUUID(),salt=newSalt(),hash=await passwordHash(body.password,salt);
  try{await db.batch([db.prepare('INSERT INTO crm_bootstrap(id) VALUES(1)'),db.prepare('INSERT INTO crm_users (id,owner_id,email,name,role,password_salt,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,id,email,typeof body.name==='string'?body.name.trim().slice(0,100):'Owner','owner',salt,hash,new Date().toISOString())])}
  catch{return Response.json({error:'Owner setup is already complete, or this email is in use.'},{status:409})}
  return Response.json({ok:true},{headers:{'Set-Cookie':await createSession(request,id),'Cache-Control':'no-store'}});
}
