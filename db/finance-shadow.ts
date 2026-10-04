import { returnLedgerStatements } from './return-ledgers.ts';
import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';
import { fixedBusinessName,stateSchema,validateRelations,type State } from '../lib/crm.ts';

export const FINANCE_DOMAIN='finances';
type WorkspaceRow={data:string;version:number};
type MigrationRow={status:string;source_version:number;verified_at:string|null;updated_at:string};

export async function loadFinanceWorkspace(ownerId:string){
  const row=await database().prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');
  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});
  return {row,state};
}
export async function getFinanceMigrationStatus(ownerId:string){
  await ensureRelationalFoundation();
  return database().prepare('SELECT status,source_version,verified_at,updated_at FROM crm_relational_migrations WHERE owner_id=? AND domain=?')
    .bind(ownerId,FINANCE_DOMAIN).first<MigrationRow>();
}
export function financeShadowStatements(ownerId:string,state:State,sourceVersion:number,now=new Date().toISOString()){
  const db=database(),q:any[]=[];
  q.push(db.prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,migrated_at=EXCLUDED.migrated_at,verified_at=NULL,updated_at=EXCLUDED.updated_at').bind(ownerId,FINANCE_DOMAIN,'migrating',sourceVersion,now,null,now));
  for(const table of ['crm_rel_finance_account_matches','crm_rel_finance_account_openings','crm_rel_finance_cash_entries','crm_rel_finance_expenses','crm_rel_finance_closes','crm_rel_finance_customer_refunds'])
    q.push(db.prepare('DELETE FROM '+table+' WHERE owner_id=?').bind(ownerId));
  state.expenses.forEach(e=>q.push(db.prepare('INSERT INTO crm_rel_finance_expenses (owner_id,id,category,amount,date,notes,vendor,reference,recurring,account,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ownerId,e.id,e.category,e.amount,e.date,e.notes,e.vendor,e.reference,e.recurring,e.account||null,0,now,now)));
  state.cashEntries.forEach(e=>q.push(db.prepare('INSERT INTO crm_rel_finance_cash_entries (owner_id,id,date,kind,category,description,amount,transfer_id,reversal_of,reversal_reason,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ownerId,e.id,e.date,e.kind,e.category,e.description,e.amount,e.transferId||null,e.reversalOf||null,e.reversalReason||null,0,now,now)));
  state.accountOpenings.forEach(a=>q.push(db.prepare('INSERT INTO crm_rel_finance_account_openings (owner_id,account,date,balance,statement_date,statement_balance,record_version,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(ownerId,a.account,a.date,a.balance,a.statementDate||null,a.statementBalance??null,0,now)));
  state.accountMatches.forEach(m=>q.push(db.prepare('INSERT INTO crm_rel_finance_account_matches (owner_id,entry_id,account,matched,reference,record_version,updated_at) VALUES (?,?,?,?,?,?,?)')
    .bind(ownerId,m.entryId,m.account,m.matched,m.reference,0,now)));
  state.customerRefunds.forEach(r=>q.push(db.prepare('INSERT INTO crm_rel_finance_customer_refunds (owner_id,id,order_id,date,amount,account,reference,reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(ownerId,r.id,r.orderId,r.date,r.amount,r.account,r.reference,r.reason,now,now)));
  state.financeCloses.forEach(x=>q.push(db.prepare('INSERT INTO crm_rel_finance_closes (owner_id,month,closed_at,closed_by,notes,record_version,updated_at) VALUES (?,?,?,?,?,?,?)')
    .bind(ownerId,x.month,x.closedAt,x.closedBy,x.notes,0,now)));
  q.push(db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?').bind('verified',sourceVersion,now,now,ownerId,FINANCE_DOMAIN));
  q.push(...returnLedgerStatements(ownerId,state,['returnSettlements','creditUses']));
  return q;
}
export async function migrateFinanceShadow(ownerId:string,state:State,sourceVersion:number){
  await ensureRelationalFoundation();
  await database().batch(financeShadowStatements(ownerId,state,sourceVersion));
}
export async function ensureFinanceApiReady(ownerId:string){
  await ensureRelationalFoundation();
  const {row,state}=await loadFinanceWorkspace(ownerId);
  const migration=await getFinanceMigrationStatus(ownerId);
  if(!migration||migration.status!=='verified')await migrateFinanceShadow(ownerId,state,row.version);
  return {row,state};
}

