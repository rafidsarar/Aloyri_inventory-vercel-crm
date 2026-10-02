import { database } from '../db/raw.ts';
import { ensureRelationalFoundation } from '../db/relational-foundation.ts';
import { migrateCustomersOrdersShadow } from '../db/customer-order-shadow.ts';
import { migrateInventorySupplierShadow } from '../db/inventory-supplier-shadow.ts';
import { migrateFinanceShadow } from '../db/finance-shadow.ts';
import { getDomainVersion } from '../db/domain-version.ts';
import { initialState,stateSchema } from '../lib/crm.ts';
import { newSalt,passwordHash } from '../app/local-auth.ts';

const ownerId='e2e-owner';
const password=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
const roles=['owner','admin','sales','inventory','finance','viewer'] as const;
const db=database();

await ensureRelationalFoundation();

const state=initialState();
state.suppliers=[{
  id:'e2e-supplier',name:'E2E Supplier',contact:'QA',phone:'01700000000',email:'qa@example.com',
  address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'Authenticated E2E fixture',verified:true
}];
state.batches=[{
  id:'e2e-batch',productId:'simple-wash',qty:50,unitCost:520,expiry:'2099-12-31',received:'2026-10-01',
  supplierId:'e2e-supplier',invoice:'E2E-INV-1',dueDate:'2026-10-31',payments:[],paid:false
}];
state.accountOpenings=[
  {account:'cash',date:'2026-01-01',balance:100000},
  {account:'bank',date:'2026-01-01',balance:100000},
  {account:'bkash',date:'2026-01-01',balance:100000},
  {account:'nagad',date:'2026-01-01',balance:100000}
];
const clean=stateSchema.parse(state);
const now=new Date().toISOString();

await db.batch([
  db.prepare('DELETE FROM crm_sessions'),
  db.prepare('DELETE FROM crm_login_attempts'),
  db.prepare('DELETE FROM crm_users WHERE owner_id=? OR id=?').bind(ownerId,ownerId),
  db.prepare('DELETE FROM crm_workspaces WHERE owner_id=?').bind(ownerId),
  db.prepare('INSERT INTO crm_workspaces(owner_id,data,version,updated_at) VALUES (?,?,1,?)').bind(ownerId,JSON.stringify(clean),now)
]);

for(const role of roles){
  const id=role==='owner'?ownerId:'e2e-'+role;
  const salt=newSalt(),hash=await passwordHash(password,salt);
  await db.prepare('INSERT INTO crm_users(id,owner_id,email,name,role,password_salt,password_hash,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,ownerId,role+'@e2e.aloyri.local','E2E '+role,role,salt,hash,1,now).run();
}

await migrateCustomersOrdersShadow(ownerId,clean,1);
await migrateInventorySupplierShadow(ownerId,clean,1);
await migrateFinanceShadow(ownerId,clean,1);
for(const domain of ['customers-orders','inventory-suppliers','finances'])await getDomainVersion(ownerId,domain);
await db.prepare("INSERT INTO crm_relational_cutover(owner_id,enabled,enabled_at,enabled_by,last_verified_at,last_verification,updated_at) VALUES (?,TRUE,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET enabled=TRUE,enabled_at=EXCLUDED.enabled_at,enabled_by=EXCLUDED.enabled_by,last_verified_at=EXCLUDED.last_verified_at,last_verification=EXCLUDED.last_verification,updated_at=EXCLUDED.updated_at")
  .bind(ownerId,now,'authenticated-e2e',now,JSON.stringify({ok:true,fixture:true}),now).run();

console.log('Seeded authenticated CRM E2E workspace for',roles.join(', '));
