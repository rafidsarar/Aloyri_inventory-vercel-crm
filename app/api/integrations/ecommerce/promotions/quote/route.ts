import { readPromotionWorkspace,quoteEcommercePromotion } from '@/db/ecommerce-promotions';
import {
  ecommerceDeliveryCharge,
  resolveEcommerceOwnerId,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';
import { ecommercePromotionQuoteInputSchema } from '@/lib/ecommerce-promotions';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/promotions/quote';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  try{
    const text=await request.text();
    if(text.length>32768)return response({error:'Request is too large.',code:'REQUEST_TOO_LARGE'},413);
    await verifyEcommerceSignature({
      method:'POST',
      path:PATH,
      integrationId:request.headers.get('x-aloyri-integration')||'',
      timestamp:request.headers.get('x-aloyri-timestamp')||'',
      nonce:request.headers.get('x-aloyri-nonce')||'',
      idempotencyKey:request.headers.get('idempotency-key')||'',
      body:text,
      signature:request.headers.get('x-aloyri-signature')||''
    });
    let json:unknown;
    try{json=JSON.parse(text)}catch{return response({error:'Invalid promotion request.',code:'INVALID_REQUEST'},400)}
    const parsed=ecommercePromotionQuoteInputSchema.safeParse(json);
    if(!parsed.success)return response({error:'Check the promotion details and try again.',code:'INVALID_REQUEST'},400);
    const ownerId=await resolveEcommerceOwnerId();
    const state=await readPromotionWorkspace(ownerId);
    const deliveryCharge=parsed.data.deliveryZone?ecommerceDeliveryCharge(parsed.data.deliveryZone):0;
    const quote=await quoteEcommercePromotion({
      ownerId,
      state,
      items:parsed.data.items,
      deliveryCharge,
      code:parsed.data.code
    });
    return response(quote);
  }catch(error){
    const message=error instanceof Error?error.message:'Could not quote promotion.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED')
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    if(message==='PROMOTION_CODE_INVALID')
      return response({error:'That promotion code is not recognized.',code:'PROMOTION_CODE_INVALID'},400);
    if(message==='PROMOTION_NOT_AVAILABLE')
      return response({error:'That promotion is not currently available.',code:'PROMOTION_NOT_AVAILABLE'},409);
    if(message==='PROMOTION_NOT_ELIGIBLE')
      return response({error:'This cart does not meet the promotion requirements.',code:'PROMOTION_NOT_ELIGIBLE'},409);
    if(message.startsWith('PRODUCT_UNAVAILABLE:'))
      return response({error:'One of the selected products is unavailable.',code:'PRODUCT_UNAVAILABLE'},409);
    if(message==='DELIVERY_RATE_NOT_CONFIGURED')
      return response({error:'Delivery pricing is not configured yet.',code:'ORDERING_NOT_CONFIGURED'},503);
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED')
      return response({error:'Promotions are not configured yet.',code:'PROMOTIONS_NOT_CONFIGURED'},503);
    console.error('Ecommerce promotion quote failed',error);
    return response({error:'Promotion pricing is temporarily unavailable.',code:'PROMOTION_SERVICE_UNAVAILABLE'},503);
  }
}
