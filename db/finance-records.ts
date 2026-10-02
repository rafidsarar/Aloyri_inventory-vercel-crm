import { database } from './raw.ts';
import { optionalRelationalDate, relationalDate } from './relational-date.ts';
import { getDomainVersion,domainVersionBumpStatements } from './domain-version.ts';
import { applyRoleChanges,validateWorkspaceChange } from '../lib/role-data.ts';
import { fixedBusinessName,stateSchema,validateRelations,type State } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureFinanceApiReady,FINANCE_DOMAIN,financeShadowStatements } from './finance-shadow.ts';

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
 const {row}=await ensureFinanceApiReady(ownerId),db=database();
 const [expenses,cashEntries,openings,matches,closes,domainVersion]=await Promise.all([
  db.prepare('SELECT id,category,amount,date,notes,vendor,reference,recurring,account FROM crm_rel_finance_expenses WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>(),
  db.prepare('SELECT id,date,kind,category,description,amount,transfer_id,reversal_of,reversal_reason FROM crm_rel_finance_cash_entries WHERE owner_id=? ORDER BY date DESC,id').bind(ownerId).all<any>(),
  db.prepare('SELECT account,date,balance,statement_date,statement_balance FROM crm_rel_finance_account_openings WHERE owner_id=? ORDER BY account').bind(ownerId).all<any>(),
  db.prepare('SELECT entry_id,account,matched,reference FROM crm_rel_finance_account_matches WHERE owner_id=? ORDER BY entry_id').bind(ownerId).all<any>(),
  db.prepare('SELECT month,closed_at,closed_by,notes FROM crm_rel_finance_closes WHERE owner_id=? ORDER BY month DESC').bind(ownerId).all<any>(),
  getDomainVersion(ownerId,FINANCE_DOMAIN)
 ]);
 const data={
  expenses:expenses.results.map((x:any)=>({id:x.id,category:x.category,amount:Number(x.amount),date:relationalDate(x.date),notes:x.notes,vendor:x.vendor,reference:x.reference,recurring:x.recurring,account:x.account||undefined})),
  cashEntries:cashEntries.results.map((x:any)=>({id:x.id,date:relationalDate(x.date),kind:x.kind,category:x.category,description:x.description,amount:Number(x.amount),transferId:x.transfer_id||undefined,reversalOf:x.reversal_of||undefined,reversalReason:x.reversal_reason||undefined})),
  accountOpenings:openings.results.map((x:any)=>({account:x.account,date:relationalDate(x.date),balance:Number(x.balance),statementDate:optionalRelationalDate(x.statement_date),statementBalance:x.statement_balance==null?undefined:Number(x.statement_balance)})),
  accountMatches:matches.results.map((x:any)=>({entryId:x.entry_id,account:x.account,matched:Boolean(x.matched),reference:x.reference})),
  financeCloses:closes.results.map((x:any)=>({month:x.month,closedAt:relationalDate(x.closed_at),closedBy:x.closed_by,notes:x.notes}))
 };
 const parsed=stateSchema.pick({expenses:true,cashEntries:true,accountOpenings:true,accountMatches:true,financeCloses:true}).parse(data);
 return {data:parsed,version:row.version,domainVersion};
}
export async function saveFinanceDomain(ownerId:string,input:unknown,expectedDomainVersion:number,actor:Actor){
 if(!['owner','admin','finance'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
 if(!Number.isInteger(expectedDomainVersion)||expectedDomainVersion<0)throw new Error('DOMAIN_VERSION_REQUIRED');
 const parsed=stateSchema.pick({expenses:true,cashEntries:true,accountOpenings:true,accountMatches:true,financeCloses:true}).safeParse(input);
 if(!parsed.success)throw new Error('INVALID_FINANCE_DATA');
 const {row,state}=await ensureFinanceApiReady(ownerId);
 const currentDomainVersion=await getDomainVersion(ownerId,FINANCE_DOMAIN);if(currentDomainVersion!==expectedDomainVersion)throw new Error('DOMAIN_VERSION_CONFLICT');
 const candidate=structuredClone(state);for(const key of financeKeys)(candidate[key] as any)=parsed.data[key] as any;
 const next=fixedBusinessName(applyRoleChanges(state,candidate,actor.role));
 if(actor.role==='finance'){
  const before=new Map(state.cashEntries.map(entry=>[entry.id,entry]));
  const ownerCategories=new Set(['owner capital','owner drawing','owner drawings']);
  for(const entry of next.cashEntries){
   const prior=before.get(entry.id);
   if((!prior||JSON.stringify(prior)!==JSON.stringify(entry))&&ownerCategories.has(entry.category.trim().toLowerCase()))
    throw new Error('FINANCE_OWNER_MONEY_FORBIDDEN');
  }
 }
 validateWorkspaceChange(state,next);validateRelations(next,{skipOrderNumberUniqueness:true});
 const changed=financeKeys.filter(k=>JSON.stringify(state[k])!==JSON.stringify(next[k]));if(!changed.length)return {data:financeData(state),version:row.version};
 const now=new Date().toISOString(),db=database(),nextVersion=row.version+1;await ensureAudit();
 await db.batch([
  db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(next),now,ownerId,row.version),
  db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END").bind(ownerId,nextVersion,now),
  ...financeShadowStatements(ownerId,next,nextVersion,now),
  ...domainVersionBumpStatements(ownerId,FINANCE_DOMAIN,expectedDomainVersion,now),
  db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,'Updated '+changed.join(', '),JSON.stringify(changed),now)
 ]);
 return {data:financeData(next),version:nextVersion,domainVersion:expectedDomainVersion+1};
}
export async function markFinanceShadowStale(ownerId:string,sourceVersion:number){
 const now=new Date().toISOString();
 await database().prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=NULL,updated_at=EXCLUDED.updated_at')
 .bind(ownerId,FINANCE_DOMAIN,'stale',sourceVersion,null,null,now).run();
}
