import { createHash } from 'node:crypto';
import { database } from '../db/raw.ts';
import { assertCanonicalState } from '../lib/data-integrity.ts';
import { getDomainVersion,domainVersionBumpStatements } from '../db/domain-version.ts';
import { INVENTORY_SUPPLIER_DOMAIN,inventorySupplierShadowStatements } from '../db/inventory-supplier-shadow.ts';

type Row={owner_id:string;data:string;version:number;updated_at:string};
const checksum=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const norm=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');

export async function cleanupDeterministicBusinessExceptions(){
  const db=database();
  const rows=await db.prepare('SELECT owner_id,data,version,updated_at FROM crm_workspaces ORDER BY owner_id').all<Row>();
  let linkedSupplierBatches=0,workspacesChanged=0;
  for(const row of rows.results){
    const state=assertCanonicalState(JSON.parse(row.data));
    const next=structuredClone(state);
    const resolved:string[]=[];
    for(const batch of next.batches){
      if(batch.supplierId||!batch.invoice.trim())continue;
      const candidates=next.purchaseOrders.filter(po=>
        norm(po.number)===norm(batch.invoice)&&
        po.items.some(item=>item.productId===batch.productId&&item.receivedQty>0)
      );
      if(candidates.length!==1)continue;
      batch.supplierId=candidates[0].supplierId;
      resolved.push(batch.id);
    }
    if(!resolved.length)continue;
    const now=new Date().toISOString(),nextVersion=row.version+1;
    const before=checksum(state);
    const domainVersion=await getDomainVersion(row.owner_id,INVENTORY_SUPPLIER_DOMAIN);
    const snapshotId=crypto.randomUUID();
    await db.batch([
      db.prepare('INSERT INTO crm_restore_snapshots (id,owner_id,workspace_version,workspace_updated_at,checksum,data,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(snapshotId,row.owner_id,row.version,row.updated_at,before,row.data,now),
      db.prepare('UPDATE crm_workspaces SET data=?,version=version+1,updated_at=? WHERE owner_id=? AND version=?')
        .bind(JSON.stringify(next),now,row.owner_id,row.version),
      db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=?) THEN 1 ELSE 0 END")
        .bind(row.owner_id,nextVersion,now),
      ...inventorySupplierShadowStatements(row.owner_id,next,nextVersion,now),
      ...domainVersionBumpStatements(row.owner_id,INVENTORY_SUPPLIER_DOMAIN,domainVersion,now),
      db.prepare('INSERT INTO crm_audit_log (id,owner_id,actor_id,actor_name,role,summary,sections,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),row.owner_id,'system','Production data cleanup','owner','Linked '+resolved.length+' legacy stock batch supplier(s) from exact purchase-order evidence',JSON.stringify(['batches']),now)
    ]);
    linkedSupplierBatches+=resolved.length;
    workspacesChanged++;
    console.log('Resolved deterministic supplier links',{ownerId:row.owner_id,count:resolved.length,snapshotId});
  }
  console.log('Deterministic business exception cleanup complete',{workspacesChanged,linkedSupplierBatches});
  return {workspacesChanged,linkedSupplierBatches};
}
