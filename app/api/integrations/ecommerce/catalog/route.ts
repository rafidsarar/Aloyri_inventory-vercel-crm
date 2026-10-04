import { readEcommerceCatalog } from '@/db/ecommerce-catalog';
import {
  resolveEcommerceOwnerId,
  verifyEcommerceSignature
} from '@/lib/ecommerce-integration';

export const dynamic='force-dynamic';
const PATH='/api/integrations/ecommerce/catalog';

const response=(data:unknown,status=200)=>Response.json(data,{
  status,
  headers:{
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  }
});

export async function GET(request:Request){
  try{
    const integrationId=request.headers.get('x-aloyri-integration')||'';
    const timestamp=request.headers.get('x-aloyri-timestamp')||'';
    const nonce=request.headers.get('x-aloyri-nonce')||'';
    const signature=request.headers.get('x-aloyri-signature')||'';
    const idempotencyKey=request.headers.get('idempotency-key')||'';

    await verifyEcommerceSignature({
      method:'GET',
      path:PATH,
      integrationId,
      timestamp,
      nonce,
      idempotencyKey,
      body:'',
      signature
    });

    const ownerId=await resolveEcommerceOwnerId();
    const catalog=await readEcommerceCatalog(ownerId);

    return response(catalog);
  }catch(error){
    const message=error instanceof Error?error.message:'Could not read storefront catalog.';
    if(message==='INTEGRATION_AUTH_FAILED'||message==='INTEGRATION_TIMESTAMP_EXPIRED')
      return response({error:'Integration authentication failed.',code:'INTEGRATION_AUTH_FAILED'},401);
    if(message==='ECOMMERCE_WORKSPACE_NOT_CONFIGURED'||message==='INTEGRATION_NOT_CONFIGURED')
      return response({error:'Website catalog is not configured yet.',code:'CATALOG_NOT_CONFIGURED'},503);

    console.error('Ecommerce catalog integration failed',error);
    return response({error:'The catalog is temporarily unavailable.',code:'CATALOG_UNAVAILABLE'},503);
  }
}
