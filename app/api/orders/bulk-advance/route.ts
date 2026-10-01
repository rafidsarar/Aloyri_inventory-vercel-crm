import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { bulkAdvanceOrdersWorkflow } from '@/db/order-workflows';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in before updating orders.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    let body:{orders?:{id:string;recordVersion:number}[]};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await bulkAdvanceOrdersWorkflow(ownerId,{orders:Array.isArray(body.orders)?body.orders:[]},{userId:user.userId,name:user.displayName||user.email,role});
    return response(result);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not advance orders.';
    if(message==='ORDER_EDIT_FORBIDDEN')return response({error:'Your role cannot update orders.'},403);
    if(message.includes('Select between'))return response({error:message},400);
    console.error('Bulk order workflow failed',error);return response({error:message},500);
  }
}