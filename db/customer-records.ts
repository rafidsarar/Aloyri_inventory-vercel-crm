import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';
import { getCustomersOrdersMigrationStatus, migrateCustomersOrdersShadow, CUSTOMER_ORDER_DOMAIN } from './customer-order-shadow.ts';
import { customerSchema, fixedBusinessName, stateSchema, validateRelations, type Customer, type State } from '../lib/crm.ts';

export type CustomerRecord=Customer&{recordVersion:number};
export type CustomerActor={userId:string;name:string;role:string};

type WorkspaceRow={data:string;version:number};
type CustomerRow={
  id:string;name:string;phone:string;address:string;city:string;preference:string;notes:string;
  consent:boolean;created:string;record_version:number;
};

const mapCustomer=(row:CustomerRow):CustomerRecord=>({
  id:row.id,name:row.name,phone:row.phone,address:row.address,city:row.city,
  preference:row.preference,notes:row.notes,consent:Boolean(row.consent),
  created:row.created,recordVersion:Number(row.record_version)
});

async function loadWorkspace(ownerId:string){
  const row=await database().prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?')
    .bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');
  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});
  return {row,state};
}

export async function ensureCustomerRecordApiReady(ownerId:string){
  await ensureRelationalFoundation();
  const {row,state}=await loadWorkspace(ownerId);
  const migration=await getCustomersOrdersMigrationStatus(ownerId);
  if(!migration||migration.status!=='verified'){
    await migrateCustomersOrdersShadow(ownerId,state,row.version);
  }
  return {row,state};
}

export async function listCustomerRecords(ownerId:string){
  const {row}=await ensureCustomerRecordApiReady(ownerId);
  const result=await database().prepare(
    'SELECT id,name,phone,address,city,preference,notes,consent,created,record_version FROM crm_rel_customers WHERE owner_id=? ORDER BY created DESC,id'
  ).bind(ownerId).all<CustomerRow>();
  return {customers:result.results.map(mapCustomer),workspaceVersion:row.version};
}

export async function getCustomerRecord(ownerId:string,id:string){
  const {row}=await ensureCustomerRecordApiReady(ownerId);
  const row=await database().prepare(
    'SELECT id,name,phone,address,city,preference,notes,consent,created,record_version FROM crm_rel_customers WHERE owner_id=? AND id=?'
  ).bind(ownerId,id).first<CustomerRow>();
  return {customer:row?mapCustomer(row):null,workspaceVersion:(await loadWorkspace(ownerId)).row.version};
}

async function ensureAuditTable(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_audit_log (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, role TEXT NOT NULL, summary TEXT NOT NULL, sections TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx ON crm_audit_log(owner_id,created_at DESC)').run();
}

function withCustomer(state:State,customer:Customer){
  const next=structuredClone(state);
  const index=next.customers.findIndex(item=>item.id===customer.id);
  if(index<0)next.customers.push(customer); else next.customers[index]=customer;
  validateRelations(next,{skipOrderNumberUniqueness:true});
  return next;
}

function withoutCustomer(state:State,id:string){
  const next=structuredClone(state);
  next.customers=next.customers.filter(customer=>customer.id!==id);
  validateRelations(next,{skipOrderNumberUniqueness:true});
  return next;
}

export async function createCustomerRecord(ownerId:string,input:unknown,actor:CustomerActor){
  const customer=customerSchema.parse(input);
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  if(state.customers.some(item=>item.id===customer.id))throw new Error('A customer with this ID already exists.');
  const next=withCustomer(state,customer);
  const now=new Date().toISOString(),nextVersion=row.version+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  await db.batch([
    db.prepare('INSERT INTO crm_rel_customers (owner_id,id,name,phone,address,city,preference,notes,consent,created,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(ownerId,customer.id,customer.name,customer.phone,customer.address,customer.city,customer.preference,customer.notes,customer.consent,customer.created,0,now,now),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_rel_customers WHERE owner_id=? AND id=? AND created_at=? AND record_version=0) THEN 1 ELSE 1/0 END")
      .bind(ownerId,customer.id,now),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
      .bind(JSON.stringify(next),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END")
      .bind(ownerId,nextVersion,now),
    db.prepare('INSERT INTO crm_relational_migrations (owner_id,domain,status,source_version,migrated_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,domain) DO UPDATE SET status=EXCLUDED.status,source_version=EXCLUDED.source_version,verified_at=EXCLUDED.verified_at,updated_at=EXCLUDED.updated_at')
      .bind(ownerId,CUSTOMER_ORDER_DOMAIN,'verified',nextVersion,null,now,now),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Created customer '+customer.name,JSON.stringify(['customers']),now)
  ]);
  return {customer:{...customer,recordVersion:0} satisfies CustomerRecord,workspaceVersion:nextVersion};
}

export async function updateCustomerRecord(ownerId:string,id:string,input:unknown,expectedVersion:number,actor:CustomerActor){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('A valid customer record version is required.');
  const customer=customerSchema.parse({...((input&&typeof input==='object')?input:{}),id});
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  if(!state.customers.some(item=>item.id===id))throw new Error('Customer not found.');
  const current=await database().prepare('SELECT record_version FROM crm_rel_customers WHERE owner_id=? AND id=?').bind(ownerId,id).first<{record_version:number}>();
  if(!current)throw new Error('Customer not found.');
  if(Number(current.record_version)!==expectedVersion)throw new Error('CUSTOMER_VERSION_CONFLICT');
  const next=withCustomer(state,customer);
  const now=new Date().toISOString(),nextWorkspaceVersion=row.version+1,nextRecordVersion=expectedVersion+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  await db.batch([
    db.prepare('UPDATE crm_rel_customers SET name=?,phone=?,address=?,city=?,preference=?,notes=?,consent=?,created=?,record_version=record_version+1,updated_at=? WHERE owner_id=? AND id=? AND record_version=?')
      .bind(customer.name,customer.phone,customer.address,customer.city,customer.preference,customer.notes,customer.consent,customer.created,now,ownerId,id,expectedVersion),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_rel_customers WHERE owner_id=? AND id=? AND record_version=? AND updated_at=?) THEN 1 ELSE 1/0 END")
      .bind(ownerId,id,nextRecordVersion,now),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
      .bind(JSON.stringify(next),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END")
      .bind(ownerId,nextWorkspaceVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?')
      .bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Updated customer '+customer.name,JSON.stringify(['customers']),now)
  ]);
  return {customer:{...customer,recordVersion:nextRecordVersion} satisfies CustomerRecord,workspaceVersion:nextWorkspaceVersion};
}

export async function deleteCustomerRecord(ownerId:string,id:string,expectedVersion:number,actor:CustomerActor){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('A valid customer record version is required.');
  const {row,state}=await ensureCustomerRecordApiReady(ownerId);
  const customer=state.customers.find(item=>item.id===id);
  if(!customer)throw new Error('Customer not found.');
  if(state.orders.some(order=>order.customerId===id))throw new Error('This customer is linked to existing orders and cannot be deleted.');
  if(state.tasks.some(task=>task.customerId===id))throw new Error('This customer is linked to follow-ups and cannot be deleted.');
  const current=await database().prepare('SELECT record_version FROM crm_rel_customers WHERE owner_id=? AND id=?').bind(ownerId,id).first<{record_version:number}>();
  if(!current)throw new Error('Customer not found.');
  if(Number(current.record_version)!==expectedVersion)throw new Error('CUSTOMER_VERSION_CONFLICT');
  const next=withoutCustomer(state,id);
  const now=new Date().toISOString(),nextWorkspaceVersion=row.version+1,auditId=crypto.randomUUID();
  await ensureAuditTable();
  const db=database();
  await db.batch([
    db.prepare('DELETE FROM crm_rel_customers WHERE owner_id=? AND id=? AND record_version=?').bind(ownerId,id,expectedVersion),
    db.prepare("SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM crm_rel_customers WHERE owner_id=? AND id=?) THEN 1 ELSE 1/0 END").bind(ownerId,id),
    db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
      .bind(JSON.stringify(next),now,ownerId,row.version),
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 1/0 END")
      .bind(ownerId,nextWorkspaceVersion,now),
    db.prepare('UPDATE crm_relational_migrations SET status=?,source_version=?,verified_at=?,updated_at=? WHERE owner_id=? AND domain=?')
      .bind('verified',nextWorkspaceVersion,now,now,ownerId,CUSTOMER_ORDER_DOMAIN),
    db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(auditId,ownerId,actor.userId,actor.name,actor.role,'Deleted customer '+customer.name,JSON.stringify(['customers']),now)
  ]);
  return {id,workspaceVersion:nextWorkspaceVersion};
}
