export type WorkspaceRole='owner'|'admin'|'sales'|'inventory'|'viewer';

export const roleCapabilities={
  owner:{sections:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],edit:['products','productCategories','customers','suppliers','purchaseOrders','batches','stockAdjustments','orders','expenses','cashEntries','accountOpenings','accountMatches','financeCloses','tasks','businessName','businessProfile','budget'],settings:true,team:true,reset:true,invoice:true,finance:true},
  admin:{sections:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],edit:['products','productCategories','customers','suppliers','purchaseOrders','batches','stockAdjustments','orders','expenses','cashEntries','accountOpenings','accountMatches','tasks','businessName','businessProfile','budget'],settings:true,team:false,reset:false,invoice:true,finance:true},
  sales:{sections:['Alerts','Orders','Customers','Follow-ups'],edit:['orders','customers','tasks'],settings:false,team:false,reset:false,invoice:true,finance:false},
  inventory:{sections:['Alerts','Inventory','Suppliers'],edit:['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments'],settings:false,team:false,reset:false,invoice:false,finance:false},
  viewer:{sections:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups'],edit:[],settings:false,team:false,reset:false,invoice:true,finance:true}
} as const satisfies Record<WorkspaceRole,{sections:readonly string[];edit:readonly string[];settings:boolean;team:boolean;reset:boolean;invoice:boolean;finance:boolean}>;

export const canManageBusinessSettings=(role:WorkspaceRole)=>roleCapabilities[role].settings;
export const roleCanEdit=(role:WorkspaceRole,key:string)=>(roleCapabilities[role].edit as readonly string[]).includes(key);
export const roleCanViewSection=(role:WorkspaceRole,section:string)=>(roleCapabilities[role].sections as readonly string[]).includes(section);
export const roleCanPrintInvoice=(role:WorkspaceRole)=>roleCapabilities[role].invoice;
export const roleCanManageTeam=(role:WorkspaceRole)=>roleCapabilities[role].team;
export const roleCanReset=(role:WorkspaceRole)=>roleCapabilities[role].reset;

export const roleCanManageFinance=(role:WorkspaceRole)=>roleCapabilities[role].finance;
