import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { postOwnerMoney } from '@/db/finance-workflows';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before posting owner money.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user);let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  if(!['capital','drawing'].includes(body.kind))return response({error:'Choose capital or drawing.'},400);
  return response(await postOwnerMoney(ownerId,{kind:body.kind,amount:Number(body.amount),date:String(body.date||''),account:String(body.account||''),reference:String(body.reference||''),version:Number(body.version)},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not post owner money.';
  if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner or an admin can post owner money.'},403);
  if(message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Finance changed in another window. Refresh and try again.'},409);
  if(message.includes('Amount')||message.includes('date')||message.includes('account'))return response({error:message},400);
  console.error('Owner money workflow failed',error);return response({error:message},500)
 }
}