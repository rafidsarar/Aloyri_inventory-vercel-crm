import { database } from '@/db/raw';

export const dynamic='force-dynamic';

const headers={
  'Cache-Control':'no-store, max-age=0',
  'Content-Type':'application/json; charset=utf-8'
};

export async function GET(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null;
  try{
    const result=await database().prepare('SELECT 1 AS ok').first<{ok:number}>();
    if(result?.ok!==1)throw new Error('Database health check failed.');
    return Response.json({status:'ok',commit},{status:200,headers});
  }catch(error){
    console.error('Health check failed',error);
    return Response.json({status:'unavailable',commit},{status:503,headers});
  }
}
