import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { receivePurchaseOrderWorkflow } from '@/db/inventory-supplier-workflows';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before receiving stock.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user),{id}=await params;
  let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  return response(await receivePurchaseOrderWorkflow(ownerId,{purchaseOrderId:id,received:String(body.received||''),invoice:String(body.invoice||''),dueDate:body.dueDate?String(body.dueDate):undefined,lines:Array.isArray(body.lines)?body.lines:[],domainVersion:Number(body.domainVersion)},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not receive purchase order.';
  if(message==='PURCHASING_FORBIDDEN')return response({error:'Your role cannot receive purchase orders.'},403);
  if(message==='DOMAIN_VERSION_CONFLICT')return response({error:'Purchasing records changed in another window. Refresh and try again.'},409);
  if(message.includes('purchase order')||message.includes('Received')||message.includes('expiry')||message.includes('quantity')||message.includes('date')||message.includes('stock'))return response({error:message},400);
  console.error('Purchase receipt workflow failed',error);return response({error:message},500);
 }
}