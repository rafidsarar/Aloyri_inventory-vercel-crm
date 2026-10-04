import { initialState,type State,statuses } from './crm.ts';
import { workspaceSummary } from './workspace-summary.ts';
import type { WorkspaceRole } from './roles.ts';
import { roleCanViewSection } from './roles.ts';
export function compactWorkspace(s:State,role:WorkspaceRole,month?:string,range?:string){
 const recent=[...s.orders].sort((a,b)=>statuses.indexOf(a.status)-statuses.indexOf(b.status)||(['Delivered','Returned','Cancelled'].includes(a.status)?b.created.localeCompare(a.created):a.created.localeCompare(b.created))||a.id.localeCompare(b.id)).slice(0,5);
 const customers=s.customers.filter(c=>recent.some(o=>o.customerId===c.id));
 const data={...initialState(),businessName:s.businessName,businessProfile:s.businessProfile,automationSettings:s.automationSettings,productCategories:s.productCategories,products:s.products,orders:recent,customers};
 const summary=workspaceSummary(s,role,month,range);
 return {data,summary:{...summary,report:roleCanViewSection(role,'Reports')?summary.report:undefined},compact:true};
}
