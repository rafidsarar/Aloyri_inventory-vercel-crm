import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { createOrderWithCustomerWorkflow } from '@/db/order-workflows';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in before creating an order.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    let body:{customer?:unknown;order?:unknown};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await createOrderWithCustomerWorkflow(ownerId,{customer:body.customer,order:body.order},{userId:user.userId,name:user.displayName||user.email,role});
    return response(result,201);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not create order.';
    if(message==='ORDER_EDIT_FORBIDDEN')return response({error:'Your role cannot create orders.'},403);
    if(message.includes('already exists')||message.includes('unique'))return response({error:message},409);
    if(message.includes('stock')||message.includes('customer')||message.includes('Discount')||message.includes('Invalid')||message.includes('match'))return response({error:message},400);
    console.error('Combined order/customer workflow failed',error);return response({error:message},500);
  }
}