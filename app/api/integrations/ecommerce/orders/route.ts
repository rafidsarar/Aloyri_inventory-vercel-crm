import { recordSecurityEvent } from '@/app/local-auth';
import { createEcommerceOrder } from '@/db/ecommerce-orders';
import {
  consumeEcommerceNonce,
  ecommerceOrderInputSchema,
  enforceEcommerceRateLimit,
  resolveEcommerceOwnerId,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/orders';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  let ownerId:string|undefined;
  try{
    const text=await request.text();
    if(text.length>65536)return response({error:'Request is too large.',code:'REQUEST_TOO_LARGE'},413);

    const integrationId=request.headers.get('x-aloyri-integration')||'';
    const timestamp=request.headers.get('x-aloyri-timestamp')||'';
    const nonce=request.headers.get('x-aloyri-nonce')||'';
    const signature=request.headers.get('x-aloyri-signature')||'';
    const idempotencyKey=request.headers.get('idempotency-key')||'';

    const auth=await verifyEcommerceSignature({
      method:'POST',
      path:PATH,
      integrationId,
      timestamp,
      nonce,
      idempotencyKey,
      body:text,
      signature
    });

    ownerId=await resolveEcommerceOwnerId();
    await consumeEcommerceNonce(integrationId,nonce);
    await enforceEcommerceRateLimit(ownerId,integrationId);

    let json:unknown;
    try{json=JSON.parse(text)}catch{return response({error:'Invalid JSON request.',code:'INVALID_REQUEST'},400)}
    const parsed=ecommerceOrderInputSchema.safeParse(json);
    if(!parsed.success)return response({error:'Check the order details and try again.',code:'INVALID_REQUEST'},400);

    const result=await createEcommerceOrder({
      ownerId,
      integrationId,
      idempotencyKey,
      payloadHash:auth.bodyHash,
      order:parsed.data
    });
    await recordSecurityEvent({
      ownerId,
      type:'integration.ecommerce_order',
      detail:'Website order '+result.orderNumber+(result.duplicate?' replayed safely':' created')
    });
    return response(result,result.duplicate?200:201);
  }catch(error){
    const message=error instanceof Error?error.message:'Could not create website order.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED')
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    if(message==='INTEGRATION_REPLAYED_REQUEST')
      return response({error:'This signed request was already used.',code:'REPLAYED_REQUEST'},409);
    if(message==='INTEGRATION_RATE_LIMITED')
      return response({error:'Too many website orders. Try again shortly.',code:'RATE_LIMITED'},429);
    if(message==='IDEMPOTENCY_CONFLICT')
      return response({error:'This checkout reference was already used with different details.',code:'IDEMPOTENCY_CONFLICT'},409);
    if(message==='ONLINE_PAYMENT_NOT_READY')
      return response({error:'Online payment verification is not enabled yet. Choose Cash on Delivery.',code:'ONLINE_PAYMENT_NOT_READY'},409);
    if(message==='INVALID_CUSTOMER_PHONE')
      return response({error:'Enter a valid Bangladesh mobile number.',code:'INVALID_CUSTOMER_PHONE'},400);
    if(message==='PROMOTION_CODE_INVALID')
      return response({error:'That promotion code is not recognized.',code:'PROMOTION_CODE_INVALID'},400);
    if(message==='PROMOTION_NOT_AVAILABLE'||message.includes('PROMOTION_LIMIT_REACHED'))
      return response({error:'That promotion is no longer available.',code:'PROMOTION_NOT_AVAILABLE'},409);
    if(message==='PROMOTION_NOT_ELIGIBLE')
      return response({error:'This order does not meet the promotion requirements.',code:'PROMOTION_NOT_ELIGIBLE'},409);
    if(message==='DELIVERY_RATE_NOT_CONFIGURED')
      return response({error:'Delivery pricing is not configured yet.',code:'ORDERING_NOT_CONFIGURED'},503);
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED')
      return response({error:'Website ordering is not configured yet.',code:'ORDERING_NOT_CONFIGURED'},503);
    if(message.startsWith('OUT_OF_STOCK:'))
      return response({error:message.slice('OUT_OF_STOCK:'.length)+' does not have enough available stock.',code:'OUT_OF_STOCK'},409);
    if(message.startsWith('PRODUCT_UNAVAILABLE:'))
      return response({error:'One of the selected products is unavailable.',code:'PRODUCT_UNAVAILABLE'},409);
    if(message.includes('Stock is over-allocated')||message.includes('Invalid stock allocation'))
      return response({error:'Stock changed while placing the order. Review the cart and try again.',code:'STOCK_CHANGED'},409);
    console.error('Ecommerce order integration failed',error);
    if(ownerId)try{await recordSecurityEvent({ownerId,type:'integration.ecommerce_order_failed',detail:message})}catch{}
    return response({error:'The order could not be created. Please try again.',code:'ORDER_CREATE_FAILED'},503);
  }
}
