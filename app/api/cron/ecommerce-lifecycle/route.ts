import { processDueEcommerceLifecycleEvents } from '@/lib/ecommerce-lifecycle-events';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const secret=(process.env.CRON_SECRET||'').trim();
  if(!secret||request.headers.get('authorization')!=='Bearer '+secret){
    return Response.json({error:'Unauthorized.'},{status:401});
  }
  return Response.json(await processDueEcommerceLifecycleEvents({limit:50}),{
    headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  });
}
