import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { reverseManualCashEntry } from '@/db/finance-workflows';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before reversing a cash movement.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user),{id}=await params;let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  return response(await reverseManualCashEntry(ownerId,{id,reason:String(body.reason||''),domainVersion:Number(body.domainVersion)},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not reverse cash movement.';
  if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner or an admin can reverse cash movements.'},403);
  if(message==='DOMAIN_VERSION_CONFLICT'||message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Finance changed in another window. Refresh and try again.'},409);
  if(message==='Cash movement not found.')return response({error:message},404);
  if(message.includes('reversal'))return response({error:message},409);
  console.error('Cash reversal workflow failed',error);return response({error:message},500)
 }
}