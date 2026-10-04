import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { roleCanEdit, roleCanViewSection } from '@/lib/roles';
import { deleteOrderRecord, getOrderRecord, updateOrderRecord, orderRecordForRole } from '@/db/order-records';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view orders.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewSection(role,'Orders'))return response({error:'You do not have access to orders.'},403);
    const {id}=await params;
    const result=await getOrderRecord(ownerId,id);
    return result.order?response({order:orderRecordForRole(result.order,role),version:result.workspaceVersion,customers:result.customers||[]}):response({error:'Order not found.'},404);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Order read failed',error);
    return response({error:'Could not load the order.'},503);
  }
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before editing an order.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'orders'))return response({error:'You do not have permission to edit orders.'},403);
    const {id}=await params;
    let body:{order?:unknown;recordVersion?:number};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await updateOrderRecord(ownerId,id,body.order,Number(body.recordVersion),{userId:user.userId,name:user.displayName||user.email,role});
    return response({order:orderRecordForRole(result.order,role),version:result.workspaceVersion});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not update order.';
    if(message==='ORDER_VERSION_CONFLICT')return response({error:'This order changed in another window. Refresh and try again.'},409);
    if(message==='Order not found.')return response({error:message},404);
    if(message.includes('role')||message.includes('Sales staff'))return response({error:message},403);
    if(message.includes('Invalid')||message.includes('unique')||message.includes('stock')||message.includes('customer')||message.includes('Discount'))return response({error:message},400);
    console.error('Order update failed',error);
    return response({error:message},500);
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before deleting an order.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'orders'))return response({error:'You do not have permission to delete orders.'},403);
    const {id}=await params;
    let body:{recordVersion?:number};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await deleteOrderRecord(ownerId,id,Number(body.recordVersion),{userId:user.userId,name:user.displayName||user.email,role});
    return response({deleted:true,id,version:result.workspaceVersion});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not delete order.';
    if(message==='ORDER_VERSION_CONFLICT')return response({error:'This order changed in another window. Refresh and try again.'},409);
    if(message==='Order not found.')return response({error:message},404);
    if(message.includes('Sales staff')||message.includes('role'))return response({error:message},403);
    if(message.includes('received stock')||message.includes('Invalid'))return response({error:message},409);
    console.error('Order delete failed',error);
    return response({error:message},500);
  }
}

