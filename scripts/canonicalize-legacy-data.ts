import { createHash } from 'node:crypto';
import { database } from '../db/raw.ts';
import { canonicalizeLegacyState } from '../lib/data-integrity.ts';

type WorkspaceRow={owner_id:string;data:string;version:number;updated_at:string};

const checksum=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function runLegacyDataCertification(){
const db=database();
const rows=await db.prepare('SELECT owner_id,data,version,updated_at FROM crm_workspaces ORDER BY owner_id').all<WorkspaceRow>();
let normalized=0,clean=0;
for(const row of rows.results){
  const now=new Date().toISOString();
  let raw:unknown;
  try{raw=JSON.parse(row.data)}
  catch(error){
    await db.prepare('INSERT INTO crm_data_integrity_events (id,owner_id,workspace_version,status,changed_paths,before_checksum,after_checksum,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),row.owner_id,row.version,'failed',0,null,null,'Workspace JSON is invalid: '+String(error),now).run();
    throw new Error('Workspace '+row.owner_id+' contains invalid JSON.');
  }
  const before=checksum(raw);
  try{
    const {state,report}=canonicalizeLegacyState(raw);
    const after=checksum(state);
    if(!report.changedPaths.length){
      clean++;
      await db.prepare('INSERT INTO crm_data_integrity_events (id,owner_id,workspace_version,status,changed_paths,before_checksum,after_checksum,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),row.owner_id,row.version,'clean',0,before,after,'Canonical validation passed.',now).run();
      continue;
    }
    const snapshotId=crypto.randomUUID();
    await db.batch([
      db.prepare('INSERT INTO crm_restore_snapshots (id,owner_id,workspace_version,workspace_updated_at,checksum,data,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(snapshotId,row.owner_id,row.version,row.updated_at,before,row.data,now),
      db.prepare('UPDATE crm_workspaces SET data=?,updated_at=? WHERE owner_id=? AND version=? AND data=?')
        .bind(JSON.stringify(state),now,row.owner_id,row.version,row.data),
      db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_workspaces WHERE owner_id=? AND version=? AND updated_at=? AND data=?) THEN 1 ELSE 0 END")
        .bind(row.owner_id,row.version,now,JSON.stringify(state)),
      db.prepare('INSERT INTO crm_data_integrity_events (id,owner_id,workspace_version,status,changed_paths,before_checksum,after_checksum,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),row.owner_id,row.version,'normalized',report.changedPaths.length,before,after,'Normalized: '+report.changedPaths.slice(0,100).join(', '),now)
    ]);
    normalized++;
    console.log('Canonicalized workspace',row.owner_id,'fields',report.changedPaths.length,'snapshot',snapshotId);
  }catch(error){
    await db.prepare('INSERT INTO crm_data_integrity_events (id,owner_id,workspace_version,status,changed_paths,before_checksum,after_checksum,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),row.owner_id,row.version,'failed',0,before,null,String(error).slice(0,1800),now).run();
    throw error;
  }
}
console.log('Legacy data certification complete',{workspaces:rows.results.length,normalized,clean});
return {workspaces:rows.results.length,normalized,clean};
}
