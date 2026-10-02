import { getAppUser } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { buildOperationalIntelligence } from '@/db/operational-intelligence';
import { roleCanViewAudit } from '@/lib/roles';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store, max-age=0','Content-Type':'application/json; charset=utf-8'};
const response=(data:unknown,status=200)=>Response.json(data,{status,headers});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view operational intelligence.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanViewAudit(role))return response({error:'Only the owner or an admin can view management intelligence and controls.'},403);
    return response(await buildOperationalIntelligence(ownerId));
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Operational intelligence failed',error);
    return response({error:'Could not load operational intelligence.'},503);
  }
}
