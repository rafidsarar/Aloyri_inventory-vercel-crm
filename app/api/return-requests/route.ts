import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { roleCanEdit,roleCanViewSection } from '@/lib/roles';
import {
  listEcommerceReturnRequests,
  returnRequestStatuses,
  updateEcommerceReturnRequest
} from '@/db/ecommerce-return-requests';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view return requests.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewSection(role,'Orders'))return response({error:'You do not have access to orders.'},403);
    return response({requests:await listEcommerceReturnRequests(ownerId)});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Return request list failed',error);
    return response({error:'Could not load website return requests.'},500);
  }
}

export async function PATCH(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to update return requests.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanEdit(role,'orders')){
      return response({error:'Your role cannot update return requests.'},403);
    }

    let body:{id?:unknown;status?:unknown;staffNote?:unknown};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    if(
      typeof body.id!=='string' ||
      typeof body.status!=='string' ||
      !returnRequestStatuses.includes(body.status as any) ||
      (body.staffNote!==undefined&&typeof body.staffNote!=='string')
    )return response({error:'Invalid return request update.'},400);

    const updated=await updateEcommerceReturnRequest(
      ownerId,
      body.id,
      {status:body.status as any,staffNote:String(body.staffNote||'')},
      {userId:user.userId,name:user.displayName||user.email,role}
    );
    return response({request:updated});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not update return request.';
    if(message==='RETURN_REQUEST_NOT_FOUND')return response({error:'Return request not found.'},404);
    if(message.startsWith('INVALID_RETURN_REQUEST'))return response({error:'Invalid return request update.'},400);
    console.error('Return request update failed',error);
    return response({error:'Could not update return request.'},500);
  }
}
