import { parsePageRequest,defaultPageRequest } from '@/lib/pagination';
import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { roleCanEdit, roleCanViewSection } from '@/lib/roles';
import { createOrderRecord, listOrderRecords, orderRecordForRole } from '@/db/order-records';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view orders.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewSection(role,'Orders'))return response({error:'You do not have access to orders.'},403);
    const result=await listOrderRecords(ownerId,parsePageRequest(request.url)||defaultPageRequest());
    return response({orders:result.orders.map(order=>orderRecordForRole(order,role)),version:result.workspaceVersion,pagination:result.pagination,customers:result.customers||[]});
  }catch(error){
    if(error instanceof Error&&error.message==='Invalid pagination.')return response({error:error.message},400);
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Order list failed',error);
    return response({error:'Could not load orders.'},503);
  }
}

export async function POST(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before creating an order.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'orders'))return response({error:'You do not have permission to create orders.'},403);
    let body:unknown;
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await createOrderRecord(ownerId,body,{userId:user.userId,name:user.displayName||user.email,role});
    return response({order:orderRecordForRole(result.order,role),version:result.workspaceVersion},201);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not create order.';
    if(message.includes('already exists')||message.includes('unique'))return response({error:message},409);
    if(message.includes('role')||message.includes('Sales staff')||message.includes('Sales orders'))return response({error:message},403);
    if(message.includes('Invalid')||message.includes('Select a customer')||message.includes('stock')||message.includes('Discount'))return response({error:message},400);
    console.error('Order create failed',error);
    return response({error:message},500);
  }
}

