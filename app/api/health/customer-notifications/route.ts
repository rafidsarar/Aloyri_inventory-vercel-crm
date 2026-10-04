import { database } from '@/db/raw';

export const dynamic='force-dynamic';

export async function GET(){
  const db=database();
  const counts=await db.prepare(
    "SELECT state,COUNT(*) AS n FROM crm_customer_notification_outbox GROUP BY state ORDER BY state"
  ).all<{state:string;n:number|string}>();
  const configured=Boolean(
    (process.env.RESEND_API_KEY||'').trim() &&
    (process.env.CUSTOMER_NOTIFICATION_FROM||'').trim()
  );

  return Response.json({
    status:'ok',
    providerConfigured:configured,
    senderConfigured:Boolean((process.env.CUSTOMER_NOTIFICATION_FROM||'').trim()),
    queue:Object.fromEntries(counts.results.map(row=>[row.state,Number(row.n)]))
  },{
    headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  });
}
