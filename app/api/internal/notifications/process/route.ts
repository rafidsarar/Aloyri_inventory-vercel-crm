import { processDueCustomerNotifications } from '@/db/customer-notifications';
import { processDueEcommerceLifecycleEvents } from '@/lib/ecommerce-lifecycle-events';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const secret=(process.env.CRON_SECRET||'').trim();
  const authorization=request.headers.get('authorization')||'';
  if(!secret||authorization!=='Bearer '+secret){
    return Response.json({error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}});
  }

  const [customerNotifications,ecommerceLifecycle]=await Promise.all([
    processDueCustomerNotifications({limit:30}),
    processDueEcommerceLifecycleEvents({limit:30})
  ]);
  return Response.json(
    {customerNotifications,ecommerceLifecycle},
    {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}
  );
}
