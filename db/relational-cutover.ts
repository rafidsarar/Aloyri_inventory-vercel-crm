import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';
import { listCustomerRecords } from './customer-records.ts';
import { listOrderRecords } from './order-records.ts';
import { getInventorySupplierDomain } from './inventory-supplier-records.ts';
import { getFinanceDomain } from './finance-records.ts';
import { fixedBusinessName,stateSchema,validateRelations,type State } from '../lib/crm.ts';

type WorkspaceRow={data:string;version:number};
type CutoverRow={enabled:boolean;enabled_at:string|null;enabled_by:string|null;last_verified_at:string|null;last_verification:string;updated_at:string};

export const relationalCoreKeys=['customers','orders','products','productCategories','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds','expenses','cashEntries','accountOpenings','accountMatches','financeCloses'] as const;

async function workspace(ownerId:string){
  const row=await database().prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');
  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  return {row,state};
}

export async function getCutoverState(ownerId:string){
  await ensureRelationalFoundation();
  const row=await database().prepare('SELECT enabled,enabled_at,enabled_by,last_verified_at,last_verification,updated_at FROM crm_relational_cutover WHERE owner_id=?').bind(ownerId).first<CutoverRow>();
  return row?{enabled:Boolean(row.enabled),enabledAt:row.enabled_at,enabledBy:row.enabled_by,lastVerifiedAt:row.last_verified_at,lastVerification:JSON.parse(row.last_verification||'{}'),updatedAt:row.updated_at}:{enabled:false,enabledAt:null,enabledBy:null,lastVerifiedAt:null,lastVerification:null,updatedAt:null};
}

export async function relationalCoreState(ownerId:string){
  const [{row,state},customers,orders,inventory,finance]=await Promise.all([
    workspace(ownerId),listCustomerRecords(ownerId),listOrderRecords(ownerId),getInventorySupplierDomain(ownerId),getFinanceDomain(ownerId)
  ]);
  const merged:State={...state,
    customers:customers.customers.map(({recordVersion:_,...x})=>x),
    orders:orders.orders.map(({recordVersion:_,...x})=>x),
    ...inventory.data,
    ...finance.data
  };
  validateRelations(merged,{skipOrderNumberUniqueness:true});
  return {state:merged,version:row.version};
}

const sum=(values:number[])=>Math.round(values.reduce((a,b)=>a+b,0)*100)/100;
export async function verifyRelationalParity(ownerId:string){
  const {row,state:json}=await workspace(ownerId);
  const {state:rel}=await relationalCoreState(ownerId);
  const counts=Object.fromEntries(relationalCoreKeys.map(key=>[key,{json:(json[key] as any[]).length,relational:(rel[key] as any[]).length,match:(json[key] as any[]).length===(rel[key] as any[]).length}]));
  const jsonOrderTotal=sum(json.orders.map(o=>o.items.reduce((n,i)=>n+i.price*i.qty,0)-o.discount+o.deliveryCharge));
  const relOrderTotal=sum(rel.orders.map(o=>o.items.reduce((n,i)=>n+i.price*i.qty,0)-o.discount+o.deliveryCharge));
  const jsonInventoryQty=sum(json.batches.map(b=>b.qty)+json.stockAdjustments.map(a=>a.delta));
  const relInventoryQty=sum(rel.batches.map(b=>b.qty)+rel.stockAdjustments.map(a=>a.delta));
  const jsonExpenses=sum(json.expenses.map(e=>e.amount)),relExpenses=sum(rel.expenses.map(e=>e.amount));
  const keyTotals={orderTotal:{json:jsonOrderTotal,relational:relOrderTotal,match:jsonOrderTotal===relOrderTotal},inventoryUnits:{json:jsonInventoryQty,relational:relInventoryQty,match:jsonInventoryQty===relInventoryQty},expenses:{json:jsonExpenses,relational:relExpenses,match:jsonExpenses===relExpenses}};
  const ids=Object.fromEntries(relationalCoreKeys.filter(k=>Array.isArray(json[k])&&k!=='productCategories'&&k!=='accountOpenings'&&k!=='accountMatches'&&k!=='financeCloses').map(key=>{
    const j=(json[key] as any[]).map(x=>x.id).sort(),r=(rel[key] as any[]).map(x=>x.id).sort();return [key,{match:JSON.stringify(j)===JSON.stringify(r)}];
  }));
  const ok=Object.values(counts).every((x:any)=>x.match)&&Object.values(keyTotals).every((x:any)=>x.match)&&Object.values(ids).every((x:any)=>x.match);
  const result={ok,workspaceVersion:row.version,counts,keyTotals,ids};
  const now=new Date().toISOString();
  await database().prepare('INSERT INTO crm_relational_cutover (owner_id,enabled,last_verified_at,last_verification,updated_at) VALUES (?,FALSE,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET last_verified_at=EXCLUDED.last_verified_at,last_verification=EXCLUDED.last_verification,updated_at=EXCLUDED.updated_at').bind(ownerId,now,JSON.stringify(result),now).run();
  return result;
}

export async function ensureRelationalCutover(ownerId:string){
  await ensureRelationalFoundation();
  const existing=await database().prepare('SELECT enabled FROM crm_relational_cutover WHERE owner_id=?').bind(ownerId).first<{enabled:boolean}>();
  if(existing)return getCutoverState(ownerId);
  const verification=await verifyRelationalParity(ownerId);
  const now=new Date().toISOString(),enabled=verification.ok;
  await database().prepare('INSERT INTO crm_relational_cutover (owner_id,enabled,enabled_at,enabled_by,last_verified_at,last_verification,updated_at) VALUES (?,?,?,?,?,?,?)')
    .bind(ownerId,enabled,enabled?now:null,enabled?'stage-3-step-8-auto-cutover':null,now,JSON.stringify(verification),now).run();
  return getCutoverState(ownerId);
}

export async function setRelationalCutover(ownerId:string,enabled:boolean,actor:string){
  const verification=await verifyRelationalParity(ownerId);
  if(enabled&&!verification.ok)throw new Error('RELATIONAL_PARITY_FAILED');
  const now=new Date().toISOString();
  await database().prepare('INSERT INTO crm_relational_cutover (owner_id,enabled,enabled_at,enabled_by,last_verified_at,last_verification,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET enabled=EXCLUDED.enabled,enabled_at=EXCLUDED.enabled_at,enabled_by=EXCLUDED.enabled_by,last_verified_at=EXCLUDED.last_verified_at,last_verification=EXCLUDED.last_verification,updated_at=EXCLUDED.updated_at')
    .bind(ownerId,enabled,enabled?now:null,enabled?actor:null,now,JSON.stringify(verification),now).run();
  return {enabled,verification};
}
