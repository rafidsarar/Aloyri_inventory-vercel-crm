import { checkOrigin,getAppUser,recordSecurityEvent } from '@/app/local-auth';
import {
  deleteEcommercePromotion,
  updateEcommercePromotion
} from '@/db/ecommerce-promotions';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function canManage(role:string){return role==='owner'||role==='admin'}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getAppUser();
  if(!user)return response({error:'Sign in required.'},401);
  if(!canManage(user.role))return response({error:'Only the owner or an admin can manage promotions.'},403);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {id}=await params;
  try{
    const promotion=await updateEcommercePromotion(user.ownerId,id,await request.json());
    await recordSecurityEvent({
      ownerId:user.ownerId,
      userId:user.userId,
      type:'ecommerce.promotion_updated',
      detail:'Updated ecommerce promotion '+promotion.name
    });
    return response({promotion});
  }catch(error){
    const message=error instanceof Error?error.message:'Could not update promotion.';
    if(message==='PROMOTION_NOT_FOUND')return response({error:'Promotion not found.'},404);
    if(message==='PROMOTION_CODE_EXISTS')return response({error:'That promotion code is already in use.'},409);
    return response({error:message},400);
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getAppUser();
  if(!user)return response({error:'Sign in required.'},401);
  if(!canManage(user.role))return response({error:'Only the owner or an admin can manage promotions.'},403);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {id}=await params;
  try{
    await deleteEcommercePromotion(user.ownerId,id);
    await recordSecurityEvent({
      ownerId:user.ownerId,
      userId:user.userId,
      type:'ecommerce.promotion_deleted',
      detail:'Deleted unused ecommerce promotion '+id
    });
    return response({ok:true});
  }catch(error){
    const message=error instanceof Error?error.message:'Could not delete promotion.';
    if(message==='PROMOTION_NOT_FOUND')return response({error:'Promotion not found.'},404);
    if(message==='PROMOTION_HAS_HISTORY')return response({error:'This promotion has redemption history. Deactivate it instead of deleting it.'},409);
    return response({error:message},400);
  }
}
