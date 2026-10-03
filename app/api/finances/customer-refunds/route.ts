import { ZodError } from 'zod';
import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { postCustomerRefund } from '@/db/finance-workflows';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before recording a refund.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user);let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  if(!body||!Number.isInteger(body.domainVersion))return response({error:'Refresh Finance before recording a refund.'},400);
  return response(await postCustomerRefund(ownerId,{refund:body.refund,domainVersion:body.domainVersion},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  if(error instanceof ZodError)return response({error:'Check the refund amount, date, account and reason.'},400);
  const message=error instanceof Error?error.message:'Could not record refund.';
  if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner, an admin or a finance manager can record refunds.'},403);
  if(message==='DOMAIN_VERSION_CONFLICT'||message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Finance changed in another window. Refresh and try again.'},409);
  if(/refund|Refund|account|returned|month|DOMAIN_VERSION_REQUIRED/.test(message))return response({error:message},400);
  console.error('Customer refund workflow failed',error);return response({error:'Could not record refund. Refresh and try again.'},500);
 }
}
