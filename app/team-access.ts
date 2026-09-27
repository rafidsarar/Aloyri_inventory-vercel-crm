import type { AppUser } from './local-auth';
import type { WorkspaceRole } from '@/lib/roles';
export type { WorkspaceRole } from '@/lib/roles';
export class AccessDenied extends Error{}
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
export async function resolveWorkspace(user:AppUser):Promise<{ownerId:string;role:WorkspaceRole}>{return {ownerId:user.ownerId,role:user.role}}
