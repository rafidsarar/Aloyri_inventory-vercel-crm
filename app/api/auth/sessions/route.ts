import { checkOrigin,clearCookie,currentSessionHash,getAppUser,recordSecurityEvent } from '@/app/local-auth';
import { database } from '@/db/raw';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});

export async function GET(request:Request){
  const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);
  const current=await currentSessionHash(request.headers.get('cookie'));
  const rows=await database().prepare('SELECT token_hash,created_at,expires_at,user_agent,last_seen_at FROM crm_sessions WHERE user_id=? AND expires_at>? ORDER BY COALESCE(last_seen_at,created_at) DESC')
    .bind(user.userId,new Date().toISOString()).all<{token_hash:string;created_at:string;expires_at:string;user_agent:string|null;last_seen_at:string|null}>();
  return reply({sessions:rows.results.map(row=>({
    id:row.token_hash.slice(0,16),
    current:row.token_hash===current,
    createdAt:row.created_at,
    expiresAt:row.expires_at,
    lastSeenAt:row.last_seen_at||row.created_at,
    userAgent:row.user_agent||'Unknown device'
  }))});
}

export async function POST(request:Request){
  if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
  const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);
  const text=await request.text();if(text.length>2048)return reply({error:'Invalid request.'},413);
  let body:any;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
  const current=await currentSessionHash(request.headers.get('cookie'));
  if(!current)return reply({error:'Current session is unavailable.'},401);
  const db=database();
  if(body.action==='revokeOthers'){
    await db.prepare('DELETE FROM crm_sessions WHERE user_id=? AND token_hash<>?').bind(user.userId,current).run();
    await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'sessions.revoke_others'});
    return reply({ok:true});
  }
  if(body.action==='revokeOne'&&typeof body.id==='string'&&/^[a-f0-9]{16}$/.test(body.id)){
    const selected=await db.prepare('SELECT token_hash FROM crm_sessions WHERE user_id=? AND LEFT(token_hash,16)=?').bind(user.userId,body.id).first<{token_hash:string}>();
    if(!selected)return reply({error:'Session not found.'},404);
    if(selected.token_hash===current)return reply({error:'Use Sign out to end your current session.'},400);
    await db.prepare('DELETE FROM crm_sessions WHERE user_id=? AND token_hash=?').bind(user.userId,selected.token_hash).run();
    await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'sessions.revoke_one'});
    return reply({ok:true});
  }
  if(body.action==='revokeAll'){
    await db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(user.userId).run();
    await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'sessions.revoke_all'});
    return reply({ok:true},{headers:{'Set-Cookie':clearCookie(request)}});
  }
  return reply({error:'Unsupported session action.'},400);
}
