import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { inspectReturnedOrderWorkflow } from '@/db/order-workflows';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in before inspecting a return.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user),{id}=await params;
    let body:{recordVersion?:number;outcome?:'Sellable'|'Quarantine'|'Damaged'};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    if(!['Sellable','Quarantine','Damaged'].includes(String(body.outcome)))return response({error:'Choose a valid inspection outcome.'},400);
    const result=await inspectReturnedOrderWorkflow(ownerId,{orderId:id,recordVersion:Number(body.recordVersion),outcome:body.outcome!},{userId:user.userId,name:user.displayName||user.email,role});
    return response(result);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not inspect return.';
    if(message==='RETURN_INSPECTION_FORBIDDEN')return response({error:'Your role cannot complete return inspection.'},403);
    if(message==='ORDER_VERSION_CONFLICT')return response({error:'This order changed in another window. Refresh and try again.'},409);
    if(message==='Order not found.')return response({error:message},404);
    if(message.includes('already been inspected')||message.includes('held safely')||message.includes('valid'))return response({error:message},409);
    console.error('Return inspection workflow failed',error);return response({error:message},500);
  }
}