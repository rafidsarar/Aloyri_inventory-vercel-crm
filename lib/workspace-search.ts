import { stock,dateLabel,taka,type State } from './crm.ts';
import { roleCanViewSection,type WorkspaceRole } from './roles.ts';
export type SearchResult={id:string;view:string;title:string;meta:string;query:string;score:number;detail?:{type:'order'|'customer'|'supplier';id:string}};
const visibleSections=(role:WorkspaceRole)=>['Orders','Customers','Inventory','Suppliers','Follow-ups','Finances'].filter(v=>roleCanViewSection(role,v));
const globalScore=(needle:string,...values:unknown[])=>{const text=values.filter(Boolean).join(' ').toLowerCase(),primary=String(values[0]||'').toLowerCase();if(!text.includes(needle))return -1;if(primary===needle)return 100;if(primary.startsWith(needle))return 80;if(text.split(/\s+/).some(part=>part.startsWith(needle)))return 60;return 40};
export function workspaceSearch(s:State,role:WorkspaceRole,globalNeedle:string){
const customerById=new Map(s.customers.map(c=>[c.id,c])),productById=new Map(s.products.map(p=>[p.id,p])),supplierById=new Map(s.suppliers.map(x=>[x.id,x]));

  if(!globalNeedle)return [];
  const results:SearchResult[]=[];
  if(visibleSections(role).includes('Orders'))for(const o of s.orders){
    const customer=customerById.get(o.customerId);
    if([o.number,o.tracking,o.channel,o.payment,o.status,customer?.name,customer?.phone].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'order-'+o.id,view:'Orders',title:'#'+o.number,meta:(customer?.name||'Customer')+' · '+o.status,query:o.number,score:globalScore(globalNeedle,o.number,customer?.name,customer?.phone,o.tracking,o.channel,o.payment,o.status),detail:{type:'order',id:o.id}});
  }
  if(visibleSections(role).includes('Customers'))for(const x of s.customers)
    if([x.name,x.phone,x.city,x.preference,x.notes].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'customer-'+x.id,view:'Customers',title:x.name,meta:(x.phone||'No phone')+(x.city?' · '+x.city:''),query:x.name,score:globalScore(globalNeedle,x.name,x.phone,x.city,x.preference,x.notes),detail:{type:'customer',id:x.id}});
  if(visibleSections(role).includes('Inventory')){
    for(const x of s.products)if([x.name,x.brand,x.category,x.size,x.id].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'product-'+x.id,view:'Inventory',title:x.brand+' '+x.name,meta:x.category+' · '+stock(s,x.id)+' available',query:x.name,score:globalScore(globalNeedle,x.name,x.brand,x.category,x.size,x.id)});
    for(const b of s.batches){
      const product=productById.get(b.productId),supplier=supplierById.get(b.supplierId);
      if([b.invoice,b.received,b.expiry,product?.name,product?.brand,supplier?.name].join(' ').toLowerCase().includes(globalNeedle))
        results.push({id:'batch-'+b.id,view:'Inventory',title:b.invoice||product?.name||'Inventory batch',meta:(product?.name||'Product')+' · expires '+dateLabel(b.expiry),query:b.invoice||product?.name||'',score:globalScore(globalNeedle,b.invoice,product?.name,product?.brand,supplier?.name,b.received,b.expiry)});
    }
  }
  if(visibleSections(role).includes('Suppliers')){
    for(const x of s.suppliers)if([x.name,x.contact,x.phone,x.email,x.address,x.notes].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'supplier-'+x.id,view:'Suppliers',title:x.name,meta:x.contact||x.phone||'Supplier',query:x.name,score:globalScore(globalNeedle,x.name,x.contact,x.phone,x.email,x.address,x.notes),detail:{type:'supplier',id:x.id}});
    for(const x of s.purchaseOrders)if([x.number,x.status,x.notes,supplierById.get(x.supplierId)?.name].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'po-'+x.id,view:'Suppliers',title:x.number,meta:'Purchase order · '+x.status,query:x.number,score:globalScore(globalNeedle,x.number,supplierById.get(x.supplierId)?.name,x.status,x.notes)});
  }
  if(visibleSections(role).includes('Follow-ups'))for(const x of s.tasks)
    if([x.title,x.kind,x.priority,x.notes,customerById.get(x.customerId)?.name].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'task-'+x.id,view:'Follow-ups',title:x.title,meta:x.kind+' · '+dateLabel(x.due),query:x.title,score:globalScore(globalNeedle,x.title,customerById.get(x.customerId)?.name,x.kind,x.priority,x.notes)});
  if(visibleSections(role).includes('Finances')){
    for(const x of s.expenses)if([x.category,x.vendor,x.reference,x.notes,x.date].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'expense-'+x.id,view:'Finances',title:x.vendor||x.category,meta:'Expense · '+taka(x.amount)+' · '+dateLabel(x.date),query:x.vendor||x.category,score:globalScore(globalNeedle,x.vendor,x.category,x.reference,x.notes,x.date)});
    for(const x of s.cashEntries)if([x.category,x.description,x.date,x.kind].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'cash-'+x.id,view:'Finances',title:x.description||x.category,meta:(x.kind==='in'?'Cash in':'Cash out')+' · '+taka(x.amount),query:x.description||x.category,score:globalScore(globalNeedle,x.description,x.category,x.date,x.kind)});
  }
  return results.sort((a,b)=>b.score-a.score||a.view.localeCompare(b.view)||a.title.localeCompare(b.title)).slice(0,18);
}
