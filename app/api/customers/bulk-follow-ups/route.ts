import { getAppUser,checkOrigin } from '@/app/local-auth';
import { resolveWorkspace } from '@/app/team-access';
import { ensureCustomerRecordApiReady } from '@/db/customer-records';
import { roleCanEdit } from '@/lib/roles';
import { uid,shiftDate } from '@/lib/crm';
import { PUT as savePreferences } from '@/app/api/workspace/preferences/route';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});if(!checkOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
 const {ownerId,role}=await resolveWorkspace(user);if(!roleCanEdit(role,'tasks'))return Response.json({error:'Your role cannot create follow-ups.'},{status:403});
 const body=await request.json();if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>200||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>120)||!Number.isInteger(body.version))return Response.json({error:'Select up to 200 customers.'},{status:400});
 const {row,state}=await ensureCustomerRecordApiReady(ownerId);if(row.version!==body.version)return Response.json({error:'Records changed. Refresh and retry.'},{status:409});
 const tasks=[...state.tasks];let created=0;for(const id of new Set<string>(body.ids)){const customer=state.customers.find(c=>c.id===id);if(!customer)return Response.json({error:'Customer no longer exists.'},{status:409});if(tasks.some(t=>t.customerId===id&&!t.done))continue;tasks.push({id:uid(),customerId:id,orderId:'',title:'Customer follow-up · '+customer.name,due:shiftDate(7),done:false,kind:'Follow-up',priority:'Normal',channel:'WhatsApp',notes:'Created from bulk customer action.',completedAt:''});created++;}
 if(!created)return Response.json({created:0});
 const result=await savePreferences(new Request(new URL('/api/workspace/preferences',request.url),{method:'PUT',headers:request.headers,body:JSON.stringify({patch:{tasks},version:row.version})}));const data=await result.json();return Response.json({...data,created},{status:result.status,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Could not create follow-ups.'},{status:503})}}
