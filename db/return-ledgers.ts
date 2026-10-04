import { database } from './raw.ts';
import type { State } from '../lib/crm.ts';
export type ReturnKey='returnSettlements'|'creditUses'|'returnInspections';
export function returnLedgerStatements(ownerId:string,state:State,keys:ReturnKey[]){const db=database(),q=[];for(const key of keys){q.push(db.prepare('DELETE FROM crm_rel_return_records WHERE owner_id=? AND kind=?').bind(ownerId,key));for(const r of state[key])q.push(db.prepare('INSERT INTO crm_rel_return_records(owner_id,kind,id,data) VALUES (?,?,?,?)').bind(ownerId,key,r.id,JSON.stringify(r)));}return q;}
export async function readReturnLedger(ownerId:string,key:ReturnKey){const rows=await database().prepare('SELECT data FROM crm_rel_return_records WHERE owner_id=? AND kind=? ORDER BY id').bind(ownerId,key).all<{data:string}>();return rows.results.map(r=>JSON.parse(r.data));}
