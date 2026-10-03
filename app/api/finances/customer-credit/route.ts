import { ZodError } from 'zod';
import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { applyCustomerCreditWorkflow } from '@/db/order-workflows';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){try{
 const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);
 const {ownerId,role}=await resolveWorkspace(user);if(!['owner','admin','finance'].includes(role))return reply({error:'Your role cannot settle returns.'},403);
 const text=await request.text();if(text.length>10000)return reply({error:'Invalid request.'},400);let body;try{body=JSON.parse(text)}catch{return reply({error:'Invalid request.'},400)}
 return reply(await applyCustomerCreditWorkflow(ownerId,{credit:body.credit,recordVersion:body.recordVersion},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(e){if(e instanceof AccessDenied)return reply({error:e.message},403);if(e instanceof ZodError)return reply({error:'Check the amount, date and reason.'},400);const message=e instanceof Error?e.message:'Could not save.';if(/VERSION_CONFLICT|division by zero/.test(message))return reply({error:'Records changed. Refresh and retry.'},409);if(/settlement|Settlement|credit|Credit|return|Return|amount|Amount|order|Order/.test(message))return reply({error:message},400);console.error('Return workflow failed',e);return reply({error:'Could not save. Refresh and retry.'},500);}}
