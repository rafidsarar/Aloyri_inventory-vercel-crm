import { z } from 'zod';
import {
  createEcommerceReturnRequest,
  returnConditions,
  returnReasons,
  returnResolutions
} from '@/db/ecommerce-return-requests';
import {
  resolveEcommerceOwnerId,
  validBangladeshPhone,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/return-requests';

const inputSchema=z.object({
  orderNumber:z.string().trim().min(8).max(100),
  phone:z.string().trim().min(10).max(30),
  reason:z.enum(returnReasons),
  condition:z.enum(returnConditions),
  preferredResolution:z.enum(returnResolutions),
  note:z.string().trim().max(2000).default(''),
  items:z.array(z.object({
    line:z.number().int().min(0).max(99),
    qty:z.number().int().min(1).max(99)
  }).strict()).min(1).max(25)
}).strict();

const response=(data:unknown,status=200)=>Response.json(data,{
  status,
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});

export async function POST(request:Request){
  try{
    const text=await request.text();
    if(text.length>12_000)return response({error:'Invalid return request.',code:'INVALID_RETURN_REQUEST'},400);

    const integrationId=request.headers.get('x-aloyri-integration')||'';
    const timestamp=request.headers.get('x-aloyri-timestamp')||'';
    const nonce=request.headers.get('x-aloyri-nonce')||'';
    const signature=request.headers.get('x-aloyri-signature')||'';
    const idempotencyKey=request.headers.get('idempotency-key')||'';

    await verifyEcommerceSignature({
      method:'POST',path:PATH,integrationId,timestamp,nonce,idempotencyKey,body:text,signature
    });

    let json:unknown;
    try{json=JSON.parse(text)}catch{
      return response({error:'Check the return request and try again.',code:'INVALID_RETURN_REQUEST'},400);
    }
    const parsed=inputSchema.safeParse(json);
    if(!parsed.success||!validBangladeshPhone(parsed.data.phone)){
      return response({error:'Check the return request and try again.',code:'INVALID_RETURN_REQUEST'},400);
    }

    const ownerId=await resolveEcommerceOwnerId();
    const result=await createEcommerceReturnRequest({ownerId,...parsed.data});

    return response({
      requestId:result.request.id,
      orderNumber:result.request.orderNumber,
      status:result.request.requestStatus,
      duplicate:result.duplicate
    },result.duplicate?200:201);
  }catch(error){
    const message=error instanceof Error?error.message:'Return request failed.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED'){
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    }
    if(message==='RETURN_ORDER_NOT_FOUND'){
      return response({error:'Check the order number and mobile number and try again.',code:'RETURN_ORDER_NOT_FOUND'},404);
    }
    if(message==='RETURN_ORDER_NOT_ELIGIBLE'){
      return response({error:'This order is not currently eligible for a return request.',code:'RETURN_ORDER_NOT_ELIGIBLE'},409);
    }
    if(message==='INVALID_RETURN_ITEMS'||message==='INVALID_RETURN_REQUEST'){
      return response({error:'Check the selected products and return details.',code:'INVALID_RETURN_REQUEST'},400);
    }
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED'){
      return response({error:'Return requests are not configured yet.',code:'RETURN_REQUEST_NOT_CONFIGURED'},503);
    }
    console.error('Ecommerce return request failed',error);
    return response({error:'Return requests are temporarily unavailable.',code:'RETURN_REQUEST_UNAVAILABLE'},503);
  }
}
