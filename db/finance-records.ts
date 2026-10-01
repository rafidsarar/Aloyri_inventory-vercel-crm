import { database } from './raw.ts';
import { applyRoleChanges,validateWorkspaceChange } from '../lib/role-data.ts';
import { fixedBusinessName,stateSchema,validateRelations,type State } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureFinanceApiReady,FINANCE_DOMAIN,migrateFinanceShadow } from './finance-shadow.ts';

export const financeKeys=['expenses','cashEntries','accountOpenings','accountMatches','financeCloses'] as const;
export type FinanceKey=typeof financeKeys[number];
export type FinanceData=Pick<State,FinanceKey>;
type Actor={userId:string;name:string;role:WorkspaceRole};

export function financeData(state:State):FinanceData{return Object.fromEntries(financeKeys.map(k=>[k,state[k]])) as FinanceData}
export function financeSectionsChanged(a:State,b:State){return financeKeys.some(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]))}
async function ensureAudit(){
 const db=database();
 await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}
export async function getFinanceDomain(ownerId:string){
 const {row,state}=await ensureFinanceApiReady(ownerId);return {data:financeData(state),version:row.version};
}
export async function saveFinanceDomain(ownerId:string,input:unknown,expectedVersion:number,actor:Actor){
 if(!['owner','admin'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
 if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('WORKSPACE_VERSION_REQUIRED');
 const parsed=stateSchema.pick({expenses:true,cashEntries:true,accountOpenings:true,accountMatches:true,financeCloses:true}).safeParse(input);
 if(!parsed.success)throw new Error('INVALID_FINANCE_DATA');
 const {row,state}=await ensureFinanceApiReady(ownerId);if(row.version!==expectedVersion)throw new Error('WORKSPACE_VERSION_CONFLICT');
 const candidate=structuredClone(state);for(const key of financeKeys)(candidate[key] as any)=parsed.data[key] as any;
 const next=fixedBusinessName(applyRoleChanges(state,candidate,actor.role));validateWorkspaceChange(state,next);validateRelations(next,{skipOrderNumberUniqueness:true});
 const changed=financeKeys.filter(k=>JSON.stringify(state[k])!==JSON.stringify(next[k]));if(!changed.length)return {data:financeData(state),version:row.version};
 const now=new Date().toISOString(),db=database(),nextVersion=row.version+1;await ensureAudit();
 const result=await db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(next),now,ownerId,row.version).run();
 if(!result.meta.changes)throw new Error('WORKSPACE_VERSION_CONFLICT');
 await migrateFinanceShadow(ownerId,next,nextVersion);
 await db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,'Updated '+changed.join(', '),JSON.stringify(changed),now).run();
 return {data:financeData(next),version:nextVersion};
}
export async function markFinanceShadowStale(ownerId:string,sourceVersion:number){
 const now=new Date().toISOString();
 await database().prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=NULL,updated_at=EXCLUDED.updated_at')
 .bind(ownerId,FINANCE_DOMAIN,'stale',sourceVersion,null,null,now).run();
}
