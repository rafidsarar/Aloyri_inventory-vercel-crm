import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { fixedBusinessName, stateSchema, validateRelations } from '@/lib/crm';
import { roleCanReset } from '@/lib/roles';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in before resetting the workspace.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!roleCanReset(role))return response({error:'Only the business owner can reset CRM data.'},403);
    const body=await request.json().catch(()=>null);
    if(body?.confirmation!=='RESET ALOYRI')return response({error:'Type RESET ALOYRI to confirm.'},400);
    const db=database();
    const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number}>();
    if(!row)return response({error:'Workspace not found.'},404);
    const current=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
    const cleaned={...current,products:[],customers:[],suppliers:[],purchaseOrders:[],batches:[],stockAdjustments:[],inventoryHolds:[],orders:[],expenses:[],cashEntries:[],accountOpenings:[],accountMatches:[],financeCloses:[],customerRefunds:[],returnSettlements:[],creditUses:[],returnInspections:[],tasks:[]};
    validateRelations(cleaned);
    const result=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(cleaned),new Date().toISOString(),ownerId,row.version).run();
    if(!result.meta.changes)return response({error:'Workspace changed while resetting. Please try again.'},409);
    const now=new Date().toISOString();
    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,user.userId,user.displayName||user.email,role,'Reset operational CRM data',JSON.stringify(['workspace reset']),now).run();
    return response({ok:true,version:row.version+1});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace reset failed',e);
    return response({error:'Could not reset CRM data. Nothing was intentionally partially cleared.'},503);
  }
}

