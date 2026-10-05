import { checkOrigin,getAppUser,recordSecurityEvent } from '@/app/local-auth';
import {
  createEcommercePromotion,
  listEcommercePromotions,
  listPromotionCatalogOptions
} from '@/db/ecommerce-promotions';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

function canManage(role:string){return role==='owner'||role==='admin'}

export async function GET(){
  const user=await getAppUser();
  if(!user)return response({error:'Sign in required.'},401);
  if(!canManage(user.role))return response({error:'Only the owner or an admin can manage promotions.'},403);
  const [promotions,catalog]=await Promise.all([
    listEcommercePromotions(user.ownerId,true),
    listPromotionCatalogOptions(user.ownerId)
  ]);
  return response({promotions,...catalog});
}

export async function POST(request:Request){
  const user=await getAppUser();
  if(!user)return response({error:'Sign in required.'},401);
  if(!canManage(user.role))return response({error:'Only the owner or an admin can manage promotions.'},403);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  try{
    const body=await request.json();
    const promotion=await createEcommercePromotion(user.ownerId,body);
    await recordSecurityEvent({
      ownerId:user.ownerId,
      userId:user.userId,
      type:'ecommerce.promotion_created',
      detail:'Created ecommerce promotion '+promotion.name
    });
    return response({promotion},201);
  }catch(error){
    const message=error instanceof Error?error.message:'Could not create promotion.';
    if(message==='PROMOTION_CODE_EXISTS')return response({error:'That promotion code is already in use.'},409);
    return response({error:message},400);
  }
}
