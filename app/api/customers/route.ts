import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { roleCanEdit, roleCanViewSection } from '@/lib/roles';
import { createCustomerRecord, listCustomerRecords } from '@/db/customer-records';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view customers.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewSection(role,'Customers'))return response({error:'You do not have access to customers.'},403);
    return response({customers:await listCustomerRecords(ownerId)});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Customer list failed',error);
    return response({error:'Could not load customers.'},503);
  }
}

export async function POST(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before creating a customer.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'customers'))return response({error:'You do not have permission to create customers.'},403);
    let body:unknown;
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const customer=await createCustomerRecord(ownerId,body,{userId:user.userId,name:user.displayName||user.email,role});
    return response({customer},201);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not create customer.';
    if(message.includes('already exists'))return response({error:message},409);
    if(message.includes('validation')||message.includes('Invalid'))return response({error:'Check the customer details.'},400);
    console.error('Customer create failed',error);
    return response({error:message},500);
  }
}
