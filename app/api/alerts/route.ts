import { getAppUser } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { ensureCustomerRecordApiReady } from '@/db/customer-records';
import { visibleState } from '@/lib/role-data';
import { workspaceSummary } from '@/lib/workspace-summary';
import { parsePageRequest,defaultPageRequest,pageMetadata } from '@/lib/pagination';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});
 const {ownerId,role}=await resolveWorkspace(user),page=parsePageRequest(request.url)||defaultPageRequest();
 if(!['All','Critical','Action needed','Upcoming'].includes(page.status))return Response.json({error:'Invalid alert filter.'},{status:400});
 const {state}=await ensureCustomerRecordApiReady(ownerId),summary=workspaceSummary(visibleState(state,role),role,undefined,undefined,null);
 const alerts=summary.roleAlerts.filter(a=>(page.status==='All'||a.level===page.status)&&(!page.q||(a.title+' '+a.detail).toLowerCase().includes(page.q.toLowerCase())));
 return Response.json({alerts:alerts.slice((page.page-1)*page.pageSize,page.page*page.pageSize),pagination:pageMetadata(page,alerts.length)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof AccessDenied)return Response.json({error:e.message},{status:403});if(e instanceof Error&&e.message==='Invalid pagination.')return Response.json({error:e.message},{status:400});return Response.json({error:'Could not load alerts.'},{status:503})}}
