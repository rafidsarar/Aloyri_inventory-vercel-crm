import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { getFinanceDomain,saveFinanceDomain } from '@/db/finance-records';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in to open finance records.'},401);
  const {ownerId,role}=await resolveWorkspace(user);if(!['owner','admin','viewer'].includes(role))return response({error:'Your role cannot access Finance.'},403);
  return response(await getFinanceDomain(ownerId));
 }catch(error){if(error instanceof AccessDenied)return response({error:error.message},403);console.error('Finance read failed',error);return response({error:'Could not load Finance records.'},503)}
}
export async function PUT(request:Request){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before saving Finance.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user);let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  return response(await saveFinanceDomain(ownerId,body.data,Number(body.domainVersion),{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not save Finance.';
  if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner or an admin can edit Finance.'},403);
  if(message==='DOMAIN_VERSION_CONFLICT'||message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Finance changed in another window. Refresh and try again.'},409);
  if(message==='DOMAIN_VERSION_REQUIRED'||message==='INVALID_FINANCE_DATA')return response({error:'Check the Finance values.'},400);
  console.error('Finance save failed',error);return response({error:message},500)
 }
}