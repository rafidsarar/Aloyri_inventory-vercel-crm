import { pbkdf2Sync,randomBytes } from 'node:crypto';
import { database } from '../db/raw.ts';
import { initialState,shiftDate,today,validateRelations } from '../lib/crm.ts';
import type { WorkspaceRole } from '../lib/roles.ts';

const password=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
const ownerId='e2e-owner';
const roles:WorkspaceRole[]=['owner','admin','sales','inventory','finance','viewer'];
const email=(role:WorkspaceRole)=>`e2e-${role}@aloyri.test`;
const hash=(password:string,salt:string)=>pbkdf2Sync(password,Buffer.from(salt,'hex'),310000,32,'sha256').toString('hex');

const state=initialState();
state.customers=[{
  id:'customer-1',name:'E2E Customer',phone:'01700000000',address:'Dhaka',city:'Dhaka',
  preference:'Sensitive skin',notes:'Certification fixture',consent:true,created:shiftDate(-30)
}];
state.suppliers=[{
  id:'supplier-1',name:'E2E Supplier',contact:'Purchasing',phone:'01800000000',email:'',
  address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'Certification fixture',verified:true
}];
state.purchaseOrders=[{
  id:'po-1',number:'PO-E2E-001',supplierId:'supplier-1',created:shiftDate(-10),expected:shiftDate(5),
  status:'Sent',notes:'Certification purchase order',
  items:[{productId:'simple-wash',qty:5,unitCost:500,receivedQty:0}]
}];
state.batches=[{
  id:'batch-1',productId:'simple-wash',qty:20,unitCost:500,expiry:shiftDate(365),received:shiftDate(-20),
  supplierId:'supplier-1',invoice:'INV-E2E-BASE',dueDate:shiftDate(20),payments:[{id:'payment-seed',date:shiftDate(-5),amount:100,note:'Protected finance fixture'}],paid:false
}];
state.accountOpenings=[{account:'cash',date:shiftDate(-90),balance:10000}];
validateRelations(state,{skipOrderNumberUniqueness:true});

if(process.env.E2E_TEST_MODE!=='1'||!process.env.E2E_DATABASE_URL||process.env.DATABASE_URL!==process.env.E2E_DATABASE_URL)
  throw new Error('Refusing destructive E2E reset outside the isolated test database.');

const db=database(),now=new Date().toISOString();
const disposableTables=await db.prepare("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'crm_%' AND tablename<>'crm_schema_migrations' ORDER BY tablename").all<{tablename:string}>();
const tableNames=disposableTables.results.map(row=>row.tablename).filter(name=>/^crm_[a-z0-9_]+$/.test(name));
if(tableNames.length)await db.prepare('TRUNCATE TABLE '+tableNames.map(name=>`"${name}"`).join(', ')+' CASCADE').run();

await db.prepare('DELETE FROM crm_sessions WHERE user_id IN (SELECT id FROM crm_users WHERE owner_id=?)').bind(ownerId).run();
await db.prepare('DELETE FROM crm_invites WHERE user_id IN (SELECT id FROM crm_users WHERE owner_id=?)').bind(ownerId).run();
await db.prepare('DELETE FROM crm_users WHERE owner_id=?').bind(ownerId).run();
await db.prepare('DELETE FROM crm_workspaces WHERE owner_id=?').bind(ownerId).run();

await db.prepare('INSERT INTO crm_workspaces (owner_id,data,version,updated_at) VALUES (?,?,0,?)')
  .bind(ownerId,JSON.stringify(state),now).run();

for(const role of roles){
  const salt=randomBytes(16).toString('hex');
  const id=role==='owner'?ownerId:`e2e-${role}`;
  await db.prepare('INSERT INTO crm_users (id,owner_id,email,name,role,password_salt,password_hash,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,ownerId,email(role),`E2E ${role}`,role,salt,hash(password,salt),1,now).run();
}
console.log('Seeded authenticated E2E workspace',{ownerId,roles,today:today()});
