export type WorkspaceRole='owner'|'admin'|'sales'|'inventory'|'viewer';

export const roleCapabilities={
  owner:{
    sections:['Overview','Alerts','Automation','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],
    edit:['products','productCategories','customers','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds','orders','expenses','cashEntries','accountOpenings','accountMatches','financeCloses','tasks','businessName','businessProfile','automationSettings'],
    settings:true,team:true,reset:true,backup:true,recordImport:true,starterCatalog:true,audit:true,invoice:true,finance:true,financeClose:true,dataExport:true,returnInspection:true
  },
  admin:{
    sections:['Overview','Alerts','Automation','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],
    edit:['products','productCategories','customers','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds','orders','expenses','cashEntries','accountOpenings','accountMatches','financeCloses','tasks','businessName','businessProfile','automationSettings'],
    settings:true,team:false,reset:false,backup:false,recordImport:true,starterCatalog:true,audit:true,invoice:true,finance:true,financeClose:true,dataExport:true,returnInspection:true
  },
  sales:{
    sections:['Alerts','Orders','Customers','Follow-ups'],
    edit:['orders','customers','tasks'],
    settings:false,team:false,reset:false,backup:false,recordImport:false,starterCatalog:false,audit:false,invoice:true,finance:false,financeClose:false,dataExport:false,returnInspection:false
  },
  inventory:{
    sections:['Alerts','Inventory','Suppliers'],
    edit:['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds'],
    settings:false,team:false,reset:false,backup:false,recordImport:false,starterCatalog:true,audit:false,invoice:false,finance:false,financeClose:false,dataExport:false,returnInspection:true
  },
  viewer:{
    sections:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups'],
    edit:[],
    settings:false,team:false,reset:false,backup:false,recordImport:false,starterCatalog:false,audit:false,invoice:true,finance:false,financeClose:false,dataExport:false,returnInspection:false
  }
} as const satisfies Record<WorkspaceRole,{
  sections:readonly string[];
  edit:readonly string[];
  settings:boolean;
  team:boolean;
  reset:boolean;
  backup:boolean;
  recordImport:boolean;
  starterCatalog:boolean;
  audit:boolean;
  invoice:boolean;
  finance:boolean;
  financeClose:boolean;
  dataExport:boolean;
  returnInspection:boolean;
}>;

export const roleLabels:Record<WorkspaceRole,string>={
  owner:'Business owner',
  admin:'Admin',
  sales:'Sales employee',
  inventory:'Inventory manager',
  viewer:'View only'
};

export const roleDescriptions:Record<WorkspaceRole,string>={
  owner:'Full CRM control including automation rules, staff access, business settings, finance, month-end, backups and workspace reset.',
  admin:'Manage business records, automation rules, orders, customers, inventory, suppliers, finance, month-end, settings, audit history and imports. Staff access, full backups and workspace reset remain owner-only.',
  sales:'Create and manage orders, customers and follow-ups; update fulfillment, tracking and notes; print customer invoices. Supplier costs, purchasing finance and accounting remain hidden.',
  inventory:'Manage catalog, stock receiving, batches, adjustments, suppliers, purchase orders and Holds & Returns, including return inspection. Customer identity and finance data remain protected.',
  viewer:'Read-only access to the operational workspace and invoices. Cannot change records, manage finance, export bulk data or access administrative controls.'
};

export const canManageBusinessSettings=(role:WorkspaceRole)=>roleCapabilities[role].settings;
export const roleCanEdit=(role:WorkspaceRole,key:string)=>(roleCapabilities[role].edit as readonly string[]).includes(key);
export const roleCanViewSection=(role:WorkspaceRole,section:string)=>(roleCapabilities[role].sections as readonly string[]).includes(section);
export const roleCanPrintInvoice=(role:WorkspaceRole)=>roleCapabilities[role].invoice;
export const roleCanManageTeam=(role:WorkspaceRole)=>roleCapabilities[role].team;
export const roleCanReset=(role:WorkspaceRole)=>roleCapabilities[role].reset;
export const roleCanBackup=(role:WorkspaceRole)=>roleCapabilities[role].backup;
export const roleCanImport=(role:WorkspaceRole)=>roleCapabilities[role].recordImport;
export const roleCanLoadStarterCatalog=(role:WorkspaceRole)=>roleCapabilities[role].starterCatalog;
export const roleCanViewAudit=(role:WorkspaceRole)=>roleCapabilities[role].audit;
export const roleCanManageFinance=(role:WorkspaceRole)=>roleCapabilities[role].finance;
export const roleCanCloseFinance=(role:WorkspaceRole)=>roleCapabilities[role].financeClose;
export const roleCanExportData=(role:WorkspaceRole)=>roleCapabilities[role].dataExport;
export const roleCanInspectReturns=(role:WorkspaceRole)=>roleCapabilities[role].returnInspection;
