import { database } from './raw.ts';
import { getDomainVersion,domainVersionBumpStatements } from './domain-version.ts';
import { accountIds,today,uid,validateRelations,type State } from '../lib/crm.ts';
import { validateWorkspaceChange } from '../lib/role-data.ts';
import type { WorkspaceRole } from '../lib/roles.ts';
import { ensureFinanceApiReady,financeShadowStatements,FINANCE_DOMAIN } from './finance-shadow.ts';

type Actor={userId:string;name:string;role:WorkspaceRole};
async function ensureAudit(){
 const db=database();
 await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}
async function commit(ownerId:string,before:State,next:State,version:number,expectedDomainVersion:number,actor:Actor,summary:string,sections:string[]){
 validateWorkspaceChange(before,next);validateRelations(next,{skipOrderNumberUniqueness:true});
 const now=new Date().toISOString(),db=database(),nextVersion=version+1;await ensureAudit();
 await db.batch([
  db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?').bind(JSON.stringify(next),now,ownerId,version),
  db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END").bind(ownerId,nextVersion,now),
  ...financeShadowStatements(ownerId,next,nextVersion,now),
  ...domainVersionBumpStatements(ownerId,FINANCE_DOMAIN,expectedDomainVersion,now),
  db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),ownerId,actor.userId,actor.name,actor.role,summary,JSON.stringify(sections),now)
 ]);
 return {version:nextVersion,domainVersion:expectedDomainVersion+1};
}
export async function postOwnerMoney(ownerId:string,input:{kind:'capital'|'drawing';amount:number;date:string;account:string;reference:string;domainVersion:number},actor:Actor){
 if(!['owner','admin'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
 if(!accountIds.includes(input.account as any))throw new Error('Choose a valid account.');
 if(!Number.isFinite(input.amount)||input.amount<=0)throw new Error('Amount must be above zero.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.date>today())throw new Error('Choose a valid date that is not in the future.');
 const {row,state}=await ensureFinanceApiReady(ownerId);if(await getDomainVersion(ownerId,FINANCE_DOMAIN)!==input.domainVersion)throw new Error('DOMAIN_VERSION_CONFLICT');
 const opening=state.accountOpenings.find(a=>a.account===input.account);if(!opening)throw new Error('Configure this account before posting owner money.');
 if(input.date<opening.date)throw new Error('Date cannot be before the account opening date.');
 const next=structuredClone(state),id=uid(),capital=input.kind==='capital';
 next.cashEntries.push({id,date:input.date,kind:capital?'in':'out',category:capital?'Owner Capital':'Owner Drawings',description:input.reference.trim()||(capital?'Owner capital contribution':'Owner withdrawal'),amount:input.amount});
 next.accountMatches.push({entryId:'manual-'+id,account:input.account as typeof accountIds[number],matched:true,reference:input.reference.trim()||(capital?'Owner capital':'Owner drawings')});
 const result=await commit(ownerId,state,next,row.version,input.domainVersion,actor,capital?'Recorded owner capital':'Recorded owner drawing',['cashEntries','accountMatches']);
 return {...result,id};
}
export async function reverseManualCashEntry(ownerId:string,input:{id:string;reason:string;domainVersion:number},actor:Actor){
 if(!['owner','admin','finance'].includes(actor.role))throw new Error('FINANCE_FORBIDDEN');
 const reason=input.reason.trim();if(!reason)throw new Error('A reversal reason is required.');
 const {row,state}=await ensureFinanceApiReady(ownerId);if(await getDomainVersion(ownerId,FINANCE_DOMAIN)!==input.domainVersion)throw new Error('DOMAIN_VERSION_CONFLICT');
 const entry=state.cashEntries.find(e=>e.id===input.id);if(!entry)throw new Error('Cash movement not found.');
 if(entry.reversalOf||state.cashEntries.some(e=>e.reversalOf===entry.id))throw new Error('This movement is already a reversal or has already been reversed.');
 const next=structuredClone(state),rid=uid();
 next.cashEntries.push({id:rid,date:today(),kind:entry.kind==='in'?'out':'in',category:'Reversal · '+entry.category,description:'Reversal of '+entry.category+' · '+reason,amount:entry.amount,reversalOf:entry.id,reversalReason:reason});
 const match=state.accountMatches.find(m=>m.entryId==='manual-'+entry.id);if(match)next.accountMatches.push({entryId:'manual-'+rid,account:match.account,matched:true,reference:'Reversal · '+reason});
 const result=await commit(ownerId,state,next,row.version,input.domainVersion,actor,'Reversed cash movement '+entry.category,['cashEntries','accountMatches']);return {...result,id:rid};
}
