import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { visibleState, applyRoleChanges } from '@/lib/role-data';
import { database } from '@/db/raw';
import { initialState, stateSchema, validateRelations, fixedBusinessName } from '@/lib/crm';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to open the workspace.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    const db=database();
    if(role==='owner')await db.prepare('INSERT OR IGNORE INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,0,?)').bind(ownerId,JSON.stringify(initialState()),new Date().toISOString()).run();
    const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number}>();
    if(!row)return response({error:'The shared workspace is not ready. Ask the owner to sign in first.'},404);
    return response({data:visibleState(fixedBusinessName(stateSchema.parse(JSON.parse(row.data))),role),version:row.version,role,userName:user.displayName});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace read failed',e);
    return response({error:'Could not load your records. Please try again.'},503);
  }
}

export async function PUT(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Please sign in before saving.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(role==='viewer')return response({error:'Your access is view-only. Ask the owner for staff access to make changes.'},403);
    const text=await request.text();
    if(text.length>1800000)return response({error:'Workspace is too large. Export a backup and contact support.'},413);
    let body;
    try{body=JSON.parse(text)}catch{return response({error:'Invalid request.'},400)}
    const parsed=stateSchema.safeParse(body.data);
    if(!parsed.success||!Number.isInteger(body.version)||body.version<0)return response({error:'Check the values in your form.'},400);
    const db=database();
    const existing=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number}>();
    if(!existing||existing.version!==body.version)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);
    const previous=fixedBusinessName(stateSchema.parse(JSON.parse(existing.data)));
    let merged:typeof previous;
    try{merged=applyRoleChanges(previous,parsed.data,role)}catch(e){return response({error:e instanceof Error?e.message:'You cannot change that section.'},403)}
    merged=fixedBusinessName(merged);
    try{validateRelations(merged)}catch(e){return response({error:e instanceof Error?e.message:'Invalid records.'},400)}
    const result=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(merged),new Date().toISOString(),ownerId,body.version).run();
    if(!result.meta.changes)return response({error:'This workspace changed in another window. Refresh records, then try again.'},409);
    return response({version:body.version+1});
  }catch(e){
    if(e instanceof AccessDenied)return response({error:e.message},403);
    console.error('Workspace save failed',e);
    return response({error:'Your changes could not be saved. Please try again.'},503);
  }
}
