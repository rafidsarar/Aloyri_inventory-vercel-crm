import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { ensureRelationalFoundation } from '@/db/relational-foundation';
import { fixedBusinessName, stateSchema, validateRelations, type State } from '@/lib/crm';
import { validateWorkspaceChange } from '@/lib/role-data';
import { canManageBusinessSettings, roleCanEdit } from '@/lib/roles';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const allowedKeys=['tasks','businessName','businessProfile','automationSettings'] as const;
type CompatibilityKey=typeof allowedKeys[number];

export async function PUT(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before saving.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(role==='viewer')return response({error:'Your access is view-only.'},403);

    let body:{patch?:Partial<Pick<State,CompatibilityKey>>;version?:number};
    try{body=await request.json()}catch{return response({error:'Invalid request.'},400)}
    if(!body.patch||typeof body.patch!=='object'||!Number.isInteger(body.version)||Number(body.version)<0)
      return response({error:'Invalid compatibility update.'},400);

    const patchKeys=Object.keys(body.patch);
    if(!patchKeys.length||patchKeys.some(key=>!(allowedKeys as readonly string[]).includes(key)))
      return response({error:'This action can only update follow-ups, automation, or business preferences.'},400);

    for(const key of patchKeys as CompatibilityKey[]){
      if((key==='businessName'||key==='businessProfile')&&!canManageBusinessSettings(role))
        return response({error:'Only the owner or an admin can edit Business settings.'},403);
      if(key!=='businessName'&&key!=='businessProfile'&&!roleCanEdit(role,key))
        return response({error:'Your role cannot change '+key+'.'},403);
    }

    await ensureRelationalFoundation();
    const db=database();
    const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number}>();
    if(!row)return response({error:'The shared workspace is not ready.'},404);
    if(row.version!==body.version)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);

    const previous=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
    const candidate=fixedBusinessName(stateSchema.parse({...previous,...body.patch}));
    validateRelations(candidate,{skipOrderNumberUniqueness:true});
    validateWorkspaceChange(previous,candidate);

    const now=new Date().toISOString();
    const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
      .bind(JSON.stringify(candidate),now,ownerId,row.version).run();
    if(!result.meta.changes)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);

    await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
    const changedKeys=(patchKeys as CompatibilityKey[]).filter(key=>JSON.stringify(previous[key])!==JSON.stringify(candidate[key]));
    if(changedKeys.length){
      const label=changedKeys.map(key=>key==='tasks'?'Follow-ups':key==='automationSettings'?'Automation':key==='businessProfile'||key==='businessName'?'Business settings':key).join(', ');
      await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),ownerId,user.userId,user.displayName||user.email,role,'Updated '+label,JSON.stringify(changedKeys),now).run();
    }

    const responsePatch=Object.fromEntries((patchKeys as CompatibilityKey[]).map(key=>[key,candidate[key]]));
    return response({version:row.version+1,patch:responsePatch});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    const message=error instanceof Error?error.message:'Could not save this CRM action.';
    if(message.includes('cannot')||message.includes('Only')||message.includes('role'))return response({error:message},403);
    if(message.includes('Invalid')||message.includes('Check'))return response({error:message},400);
    console.error('Compatibility action save failed',error);
    return response({error:'Could not save this CRM action. Please refresh and try again.'},500);
  }
}
