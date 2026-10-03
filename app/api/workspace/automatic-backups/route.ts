import { getAppUser,checkOrigin } from '@/app/local-auth';
import { resolveWorkspace,AccessDenied } from '@/app/team-access';
import { database } from '@/db/raw';
import { ensureDailyBackup,backupChecksum,backupCounts } from '@/db/automatic-backups';
import { stateSchema,validateRelations } from '@/lib/crm';
export const dynamic='force-dynamic';
const reply=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{const user=await getAppUser();if(!user)return reply({error:'Sign in first.'},401);const {ownerId,role}=await resolveWorkspace(user);if(role!=='owner')return reply({error:'Only the owner can access full backups.'},403);
 await ensureDailyBackup(ownerId);const day=new URL(request.url).searchParams.get('day'),db=database();
 if(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return reply({error:'Invalid backup date.'},400);const row=await db.prepare('SELECT data,checksum,workspace_version,created_at FROM crm_automatic_backups WHERE owner_id=? AND day=?').bind(ownerId,day).first<{data:string;checksum:string;workspace_version:number;created_at:string}>();if(!row)return reply({error:'Backup not found.'},404);const raw=JSON.parse(row.data);if(await backupChecksum(raw)!==row.checksum)return reply({error:'Backup checksum failed.'},409);const data=stateSchema.parse(raw);validateRelations(data,{skipOrderNumberUniqueness:true});return reply({format:'aloyri-workspace-backup',schemaVersion:4,source:'automatic-database-safety-copy',createdAt:row.created_at,workspaceVersion:row.workspace_version,integrity:{algorithm:'SHA-256',checksum:await backupChecksum(data),counts:backupCounts(data),relationsValidated:true},data});}
 const rows=await db.prepare('SELECT day,created_at,workspace_version FROM crm_automatic_backups WHERE owner_id=? ORDER BY day DESC').bind(ownerId).all<{day:string;created_at:string;workspace_version:number}>();return reply({backups:rows.results});
 }catch(e){if(e instanceof AccessDenied)return reply({error:e.message},403);return reply({error:'Could not load automatic backups.'},503);}}
export async function POST(request:Request){if(!checkOrigin(request))return reply({error:'Invalid request origin.'},403);return GET(request);}
