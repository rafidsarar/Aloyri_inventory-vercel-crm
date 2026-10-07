import { recordSecurityEvent } from '@/app/local-auth';
import {
  ecommerceCustomerAccountInputSchema,
  upsertEcommerceCustomerAccount
} from '@/db/ecommerce-customer-accounts';
import {
  consumeEcommerceNonce,
  enforceEcommerceRateLimit,
  resolveEcommerceOwnerId,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/customers';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function POST(request:Request){
  let ownerId:string|undefined;
  try{
    const text=await request.text();
    if(text.length>16_384)return response({error:'Request is too large.',code:'REQUEST_TOO_LARGE'},413);

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

    ownerId=await resolveEcommerceOwnerId();
    await consumeEcommerceNonce(integrationId,nonce);
    await enforceEcommerceRateLimit(ownerId,integrationId);

    let json:unknown;
    try{json=JSON.parse(text)}catch{return response({error:'Invalid JSON request.',code:'INVALID_REQUEST'},400)}
    const parsed=ecommerceCustomerAccountInputSchema.safeParse(json);
    if(!parsed.success)return response({error:'Check the customer account details.',code:'INVALID_REQUEST'},400);

    const result=await upsertEcommerceCustomerAccount({
      ownerId,
      account:parsed.data,
      actor:{
        userId:'integration:'+integrationId,
        name:'Aloyri Website',
        role:'integration'
      }
    });

    await recordSecurityEvent({
      ownerId,
      type:'integration.ecommerce_customer_account',
      detail:'Website customer account '+parsed.data.accountId+' linked to customer '+result.customerId
    });

    return response(result,result.created?201:200);
  }catch(error){
    const message=error instanceof Error?error.message:'Could not link website customer.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED')
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    if(message==='INTEGRATION_REPLAYED_REQUEST')
      return response({error:'This signed request was already used.',code:'REPLAYED_REQUEST'},409);
    if(message==='INTEGRATION_RATE_LIMITED')
      return response({error:'Too many website requests. Try again shortly.',code:'RATE_LIMITED'},429);
    if(message==='INVALID_CUSTOMER_PHONE')
      return response({error:'Enter a valid Bangladesh mobile number.',code:'INVALID_CUSTOMER_PHONE'},400);
    if(message==='CUSTOMER_ACCOUNT_EMAIL_CONFLICT')
      return response({error:'This email is already linked to another customer account.',code:'CUSTOMER_ACCOUNT_EMAIL_CONFLICT'},409);
    if(message==='CUSTOMER_ACCOUNT_PHONE_CONFLICT')
      return response({error:'This mobile number is already linked to another customer account.',code:'CUSTOMER_ACCOUNT_PHONE_CONFLICT'},409);
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED')
      return response({error:'Website customer integration is not configured yet.',code:'CUSTOMER_SYNC_NOT_CONFIGURED'},503);
    console.error('Ecommerce customer account integration failed',error);
    if(ownerId)try{await recordSecurityEvent({ownerId,type:'integration.ecommerce_customer_account_failed',detail:message})}catch{}
    return response({error:'Customer account could not be linked to CRM.',code:'CUSTOMER_SYNC_FAILED'},503);
  }
}
