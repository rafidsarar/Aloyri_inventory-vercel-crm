import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { getInventorySupplierDomain, saveInventorySupplierDomain } from '@/db/inventory-supplier-records';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in to open inventory records.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!['owner','admin','inventory','finance','viewer'].includes(role))return response({error:'Your role cannot access Inventory or Suppliers.'},403);
    const result=await getInventorySupplierDomain(ownerId);
    if(role==='inventory'){
      return response({...result,data:{...result.data,batches:result.data.batches.map(batch=>({
        ...batch,payments:[],paid:false,paidAt:undefined
      }))}});
    }
    return response(result);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Inventory supplier domain read failed',error);return response({error:'Could not load Inventory and Supplier records.'},503);
  }
}

export async function PUT(request:Request){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in before saving.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!['owner','admin','inventory'].includes(role))return response({error:'Your role cannot edit Inventory or Suppliers.'},403);
    let body:{data?:unknown;domainVersion?:number};try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await saveInventorySupplierDomain(ownerId,body.data,Number(body.domainVersion),{userId:user.userId,name:user.displayName||user.email,role});
    return response(result);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not save Inventory and Supplier records.';
    if(message==='DOMAIN_VERSION_CONFLICT'||message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Inventory or Supplier records changed in another window. Refresh and try again.'},409);
    if(message==='DOMAIN_VERSION_REQUIRED'||message==='INVALID_INVENTORY_SUPPLIER_DATA')return response({error:'Check the values in your form.'},400);
    if(message==='Use return inspection to record its history.')return response({error:message},400);
    if(message.includes('cannot')||message.includes('Only')||message.includes('role'))return response({error:message},403);
    console.error('Inventory supplier domain save failed',error);return response({error:message},500);
  }
}