import { processDueCustomerNotifications } from '@/db/customer-notifications';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const secret=(process.env.CRON_SECRET||'').trim();
  const authorization=request.headers.get('authorization')||'';
  if(!secret||authorization!=='Bearer '+secret){
    return Response.json({error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}});
  }

  const result=await processDueCustomerNotifications({limit:30});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
