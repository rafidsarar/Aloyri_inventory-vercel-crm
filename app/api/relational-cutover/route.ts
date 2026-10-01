import { getAppUser,checkOrigin } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { canManageBusinessSettings } from '@/lib/roles';
import { getCutoverState,setRelationalCutover,verifyRelationalParity } from '@/db/relational-cutover';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in to view relational status.'},401);
  const {ownerId,role}=await resolveWorkspace(user);if(!canManageBusinessSettings(role))return response({error:'Only the owner or an admin can view relational status.'},403);
  const [cutover,verification]=await Promise.all([getCutoverState(ownerId),verifyRelationalParity(ownerId)]);
  return response({cutover,verification});
 }catch(error){if(error instanceof AccessDenied)return response({error:error.message},403);console.error('Relational cutover status failed',error);return response({error:error instanceof Error?error.message:'Could not verify relational data.'},500)}
}
export async function POST(request:Request){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before changing relational cutover.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user);if(role!=='owner')return response({error:'Only the owner can change relational cutover.'},403);
  let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  if(typeof body.enabled!=='boolean')return response({error:'enabled must be true or false.'},400);
  return response(await setRelationalCutover(ownerId,body.enabled,user.displayName||user.email));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not change relational cutover.';
  if(message==='RELATIONAL_PARITY_FAILED')return response({error:'Relational verification failed. Cutover was not enabled.'},409);
  console.error('Relational cutover change failed',error);return response({error:message},500)
 }
}