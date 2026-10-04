import { getAppUser } from '@/app/local-auth';
import { AccessDenied,resolveWorkspace } from '@/app/team-access';
import { ensureCustomerRecordApiReady } from '@/db/customer-records';
import { visibleState } from '@/lib/role-data';
import { roleCanViewSection } from '@/lib/roles';
import { accountIds } from '@/lib/crm';
import { parsePageRequest,defaultPageRequest } from '@/lib/pagination';
import { sectionKinds,sectionPage,type SectionKind } from '@/lib/section-records';
export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return response({error:'Sign in first.'},401);
 const {ownerId,role}=await resolveWorkspace(user),params=new URL(request.url).searchParams,kind=params.get('kind')||'';
 if(!Object.hasOwn(sectionKinds,kind))return response({error:'Invalid record list.'},400);
 if(!roleCanViewSection(role,sectionKinds[kind as SectionKind]))return response({error:'Your role cannot view this list.'},403);
 const page=parsePageRequest(request.url)||defaultPageRequest(),sort=params.get('sort')||undefined,month=params.get('month')||undefined,range=params.get('range')||undefined,account=params.get('account')||undefined,expected=params.get('expectedVersion');
 if(sort&&sort.length>50||month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||range&&!['30','all'].includes(range)||account&&!accountIds.includes(account as typeof accountIds[number])||expected!==null&&(!/^\d+$/.test(expected)||!Number.isSafeInteger(Number(expected))))return response({error:'Invalid list options.'},400);
 const {state,row}=await ensureCustomerRecordApiReady(ownerId);
 if(expected!==null&&Number(expected)!==row.version)return response({error:'Records changed. Refreshing the workspace.',version:row.version},409);
 return response({...sectionPage(visibleState(state,role),kind as SectionKind,page,{sort,month,range,account}),version:row.version});
 }catch(e){if(e instanceof AccessDenied)return response({error:e.message},403);if(e instanceof Error&&e.message==='Invalid pagination.')return response({error:e.message},400);console.error('Record page failed',e);return response({error:'Could not load this record page.'},503)}}
