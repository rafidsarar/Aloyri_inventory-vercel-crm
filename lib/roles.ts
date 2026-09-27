export type WorkspaceRole='owner'|'sales'|'inventory'|'viewer';
export const roleCanEdit=(role:WorkspaceRole,key:string)=>role==='owner'||(role==='sales'&&['orders','customers','tasks'].includes(key))||(role==='inventory'&&['products','batches','suppliers','stockAdjustments'].includes(key));
