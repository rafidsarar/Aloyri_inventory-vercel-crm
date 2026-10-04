import { getAppUser } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { ensureCustomerRecordApiReady } from '@/db/customer-records';
import { visibleState } from '@/lib/role-data';
import { workspaceSearch } from '@/lib/workspace-search';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});const {ownerId,role}=await resolveWorkspace(user),q=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase();
 if(q.length>100)return Response.json({error:'Search is too long.'},{status:400});if(q.length<1)return Response.json({results:[]});
 const {state}=await ensureCustomerRecordApiReady(ownerId);return Response.json({results:workspaceSearch(visibleState(state,role),role,q)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof AccessDenied)return Response.json({error:e.message},{status:403});return Response.json({error:'Could not search records.'},{status:503})}}
