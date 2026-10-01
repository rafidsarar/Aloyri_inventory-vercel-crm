import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { postSupplierPaymentWorkflow } from '@/db/inventory-supplier-workflows';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getAppUser();if(!user)return response({error:'Sign in before posting supplier payment.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user),{id}=await params;
  let body:any;try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
  return response(await postSupplierPaymentWorkflow(ownerId,{batchId:id,date:String(body.date||''),amount:Number(body.amount),note:String(body.note||''),account:String(body.account||''),domainVersion:Number(body.domainVersion)},{userId:user.userId,name:user.displayName||user.email,role}));
 }catch(error){
  if(error instanceof AccessDenied)return response({error:error.message},403);
  const message=error instanceof Error?error.message:'Could not post supplier payment.';
  if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner or an admin can post supplier payments.'},403);
  if(message==='DOMAIN_VERSION_CONFLICT'||message==='WORKSPACE_VERSION_CONFLICT')return response({error:'Supplier records changed in another window. Refresh and try again.'},409);
  if(message==='Inventory batch not found.')return response({error:message},404);
  if(message.includes('exceed')||message.includes('amount')||message.includes('date')||message.includes('account'))return response({error:message},400);
  console.error('Supplier payment workflow failed',error);return response({error:message},500);
 }
}