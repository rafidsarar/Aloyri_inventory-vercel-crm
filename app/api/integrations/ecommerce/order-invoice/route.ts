import { z } from 'zod';
import { readEcommerceOrderInvoice } from '@/db/ecommerce-order-invoice';
import {
  resolveEcommerceOwnerId,
  validBangladeshPhone,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/order-invoice';

const trackingInput=z.object({
  orderNumber:z.string().trim().min(8).max(100),
  phone:z.string().trim().min(10).max(30)
}).strict();

const response=(data:unknown,status=200)=>Response.json(data,{
  status,
  headers:{
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  }
});

export async function POST(request:Request){
  try{
    const text=await request.text();
    if(text.length>4096)return response({error:'Invalid tracking request.',code:'INVALID_REQUEST'},400);

    const integrationId=request.headers.get('x-aloyri-integration')||'';
    const timestamp=request.headers.get('x-aloyri-timestamp')||'';
    const nonce=request.headers.get('x-aloyri-nonce')||'';
    const signature=request.headers.get('x-aloyri-signature')||'';
    const idempotencyKey=request.headers.get('idempotency-key')||'';

    await verifyEcommerceSignature({
      method:'POST',
      path:PATH,
      integrationId,
      timestamp,
      nonce,
      idempotencyKey,
      body:text,
      signature
    });

    let json:unknown;
    try{json=JSON.parse(text)}catch{
      return response({error:'Check the order number and mobile number and try again.',code:'TRACKING_NOT_FOUND'},404);
    }

    const parsed=trackingInput.safeParse(json);
    if(!parsed.success || !validBangladeshPhone(parsed.data.phone)){
      return response({error:'Check the order number and mobile number and try again.',code:'TRACKING_NOT_FOUND'},404);
    }

    const ownerId=await resolveEcommerceOwnerId();
    const result=await readEcommerceOrderInvoice(
      ownerId,
      parsed.data.orderNumber,
      parsed.data.phone
    );

    if(!result){
      return response({error:'Check the order number and mobile number and try again.',code:'TRACKING_NOT_FOUND'},404);
    }

    return response(result);
  }catch(error){
    const message=error instanceof Error?error.message:'Tracking is unavailable.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED'){
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    }
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED'){
      return response({error:'Order tracking is not configured yet.',code:'TRACKING_NOT_CONFIGURED'},503);
    }

    console.error('Ecommerce order tracking failed',error);
    return response({error:'Order tracking is temporarily unavailable.',code:'TRACKING_UNAVAILABLE'},503);
  }
}
