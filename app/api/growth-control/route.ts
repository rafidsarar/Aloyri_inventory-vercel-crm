import { getAppUser } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { buildGrowthControl } from '@/db/growth-control';
import { roleCanViewAudit } from '@/lib/roles';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view business control intelligence.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewAudit(role))return response({error:'Only the owner or an admin can view growth-control intelligence.'},403);
    return response(await buildGrowthControl(ownerId));
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Business control intelligence failed',error);
    return response({error:'Could not load business operations and growth control.'},503);
  }
}
