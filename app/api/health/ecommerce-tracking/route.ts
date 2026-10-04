export const dynamic='force-dynamic';

const STORE_URL='https://aloyri-ecommerce.vercel.app/api/track-order';

export async function GET(){
  const started=Date.now();
  try{
    const upstream=await fetch(STORE_URL,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'user-agent':'Aloyri-CRM-Tracking-Roundtrip/1.0'
      },
      body:JSON.stringify({
        orderNumber:'WEB-HEALTH-DOES-NOT-EXIST',
        phone:'01700000000'
      }),
      cache:'no-store',
      signal:AbortSignal.timeout(10000)
    });

    let body:unknown;
    try{body=await upstream.json()}catch{body=null}
    const code=
      body && typeof body==='object' && 'code' in body && typeof (body as {code?:unknown}).code==='string'
        ? (body as {code:string}).code
        : '';

    const healthy=upstream.status===404 && code==='TRACKING_NOT_FOUND';

    return Response.json({
      status:healthy?'ok':'error',
      trackingRoundtrip:healthy?'healthy':'unhealthy',
      upstreamStatus:upstream.status,
      upstreamCode:code||null,
      durationMs:Date.now()-started
    },{
      status:healthy?200:503,
      headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
    });
  }catch(error){
    console.error('Tracking roundtrip health check failed',error);
    return Response.json({
      status:'error',
      trackingRoundtrip:'unhealthy',
      upstreamStatus:null,
      upstreamCode:'ROUNDTRIP_UNAVAILABLE',
      durationMs:Date.now()-started
    },{
      status:503,
      headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
    });
  }
}
