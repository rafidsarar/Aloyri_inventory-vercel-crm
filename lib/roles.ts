export type WorkspaceRole='owner'|'admin'|'sales'|'inventory'|'viewer';
export const canManageBusinessSettings=(role:WorkspaceRole)=>role==='owner'||role==='admin';
export const roleCanEdit=(role:WorkspaceRole,key:string)=>canManageBusinessSettings(role)||(role==='sales'&&['orders','customers','tasks'].includes(key))||(role==='inventory'&&['products','productCategories','batches','suppliers','stockAdjustments'].includes(key));
