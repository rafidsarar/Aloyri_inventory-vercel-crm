import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { postOrderCollection } from '@/db/order-workflows';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getAppUser();if(!user)return response({error:'Sign in before posting a collection.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user),{id}=await params;
    let body:{recordVersion?:number;date?:string;amount?:number;reference?:string;account?:string};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    const result=await postOrderCollection(ownerId,{orderId:id,recordVersion:Number(body.recordVersion),date:String(body.date||''),amount:Number(body.amount),reference:String(body.reference||''),account:String(body.account||'')},{userId:user.userId,name:user.displayName||user.email,role});
    return response(result);
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not post collection.';
    if(message==='FINANCE_FORBIDDEN')return response({error:'Only the owner or an admin can post customer collections.'},403);
    if(message==='ORDER_VERSION_CONFLICT')return response({error:'This order changed in another window. Refresh and try again.'},409);
    if(message==='Order not found.')return response({error:message},404);
    if(message.includes('exceed')||message.includes('not ready')||message.includes('opening')||message.includes('date')||message.includes('amount')||message.includes('valid'))return response({error:message},400);
    console.error('Collection workflow failed',error);return response({error:message},500);
  }
}