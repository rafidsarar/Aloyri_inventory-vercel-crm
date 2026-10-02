import { checkOrigin, clearCookie, getAppUser, recordSecurityEvent, revokeSession } from '@/app/local-auth';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const user=await getAppUser();
  await revokeSession(request.headers.get('cookie'));
  if(user){try{await recordSecurityEvent({ownerId:user.ownerId,userId:user.userId,type:'auth.logout'})}catch{}}
  return Response.json({ok:true},{headers:{'Set-Cookie':clearCookie(request),'Cache-Control':'no-store'}});
}
