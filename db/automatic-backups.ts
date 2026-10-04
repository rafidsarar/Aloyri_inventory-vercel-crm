import { database } from './raw.ts';
import { stateSchema,today,shiftDate,validateRelations,type State } from '../lib/crm.ts';
export async function backupChecksum(data:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function backupCounts(s:State){return Object.fromEntries(Object.entries(s).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).length]));}
/** Keep one validated database safety copy per active day, for thirty days. */
export async function ensureDailyBackup(ownerId:string){
 const db=database(),day=today(),existing=await db.prepare('SELECT day FROM crm_automatic_backups WHERE owner_id=? AND day=?').bind(ownerId,day).first<{day:string}>();if(existing)return;
 const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string;version:number}>();if(!row)return;
 const data=stateSchema.parse(JSON.parse(row.data));validateRelations(data,{skipOrderNumberUniqueness:true});const checksum=await backupChecksum(data),now=new Date().toISOString();
 await db.batch([db.prepare('INSERT INTO crm_automatic_backups(owner_id,day,data,checksum,workspace_version,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id,day) DO NOTHING').bind(ownerId,day,JSON.stringify(data),checksum,row.version,now),db.prepare('DELETE FROM crm_automatic_backups WHERE owner_id=? AND day<?').bind(ownerId,shiftDate(-29))]);
}
