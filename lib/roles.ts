export type WorkspaceRole='owner'|'admin'|'sales'|'inventory'|'viewer';
export const roleCanEdit=(role:WorkspaceRole,key:string)=>role==='owner'||role==='admin'||(role==='sales'&&['orders','customers','tasks'].includes(key))||(role==='inventory'&&['products','productCategories','batches','suppliers','stockAdjustments'].includes(key));
