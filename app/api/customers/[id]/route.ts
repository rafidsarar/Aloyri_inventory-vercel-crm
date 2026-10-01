import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { roleCanEdit, roleCanViewSection } from '@/lib/roles';
import { deleteCustomerRecord, getCustomerRecord, updateCustomerRecord } from '@/db/customer-records';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view customers.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewSection(role,'Customers'))return response({error:'You do not have access to customers.'},403);
    const {id}=await params;
    const customer=await getCustomerRecord(ownerId,id);
    return customer?response({customer}):response({error:'Customer not found.'},404);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Customer read failed',error);
    return response({error:'Could not load the customer.'},503);
  }
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before editing a customer.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'customers'))return response({error:'You do not have permission to edit customers.'},403);
    const {id}=await params;
    let body:{customer?:unknown;recordVersion?:number};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const customer=await updateCustomerRecord(ownerId,id,body.customer,Number(body.recordVersion),{userId:user.userId,name:user.displayName||user.email,role});
    return response({customer});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not update customer.';
    if(message==='CUSTOMER_VERSION_CONFLICT')return response({error:'This customer changed in another window. Refresh and try again.'},409);
    if(message==='Customer not found.')return response({error:message},404);
    if(message.includes('validation')||message.includes('valid customer record version'))return response({error:'Check the customer details.'},400);
    console.error('Customer update failed',error);
    return response({error:message},500);
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before deleting a customer.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'customers'))return response({error:'You do not have permission to delete customers.'},403);
    const {id}=await params;
    let body:{recordVersion?:number};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    await deleteCustomerRecord(ownerId,id,Number(body.recordVersion),{userId:user.userId,name:user.displayName||user.email,role});
    return response({deleted:true,id});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not delete customer.';
    if(message==='CUSTOMER_VERSION_CONFLICT')return response({error:'This customer changed in another window. Refresh and try again.'},409);
    if(message==='Customer not found.')return response({error:message},404);
    if(message.includes('linked to'))return response({error:message},409);
    if(message.includes('valid customer record version'))return response({error:message},400);
    console.error('Customer delete failed',error);
    return response({error:message},500);
  }
}
