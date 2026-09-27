import { getAppUser, checkOrigin } from '@/app/local-auth';
import { database } from '@/db/raw';
import { stateSchema,validateRelations } from '@/lib/crm';
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const user=await getAppUser();if(!user||user.role!=='owner')return Response.json({error:'Only the owner can import records.'},{status:403});
  const text=await request.text();if(text.length>1800000)return Response.json({error:'Backup is too large.'},{status:413});
  let raw:any;try{raw=JSON.parse(text)}catch{return Response.json({error:'Invalid JSON backup.'},{status:400})}
  const parsed=stateSchema.safeParse(raw.data||raw);
  if(!parsed.success)return Response.json({error:'This is not a valid Skinventory backup.'},{status:400});
  try{validateRelations(parsed.data)}catch{return Response.json({error:'Backup has inconsistent records.'},{status:400})}
  const db=database();
  const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(user.ownerId).first<{data:string;version:number}>();
  if(row){const current=stateSchema.parse(JSON.parse(row.data));if(row.version!==0||current.customers.length||current.orders.length||current.batches.length||current.expenses.length)return Response.json({error:'This workspace already has records. Import into a new empty workspace only.'},{status:409})}
  const result=row?await db.prepare('UPDATE crm_workspaces SET data=?,version=1,updated_at=? WHERE owner_id=? AND version=0').bind(JSON.stringify(parsed.data),new Date().toISOString(),user.ownerId).run():await db.prepare('INSERT INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,1,?)').bind(user.ownerId,JSON.stringify(parsed.data),new Date().toISOString()).run();
  if(!result.meta.changes)return Response.json({error:'Workspace changed. Refresh before importing.'},{status:409});
  return Response.json({ok:true,customers:parsed.data.customers.length,orders:parsed.data.orders.length},{headers:{'Cache-Control':'no-store'}});
}
