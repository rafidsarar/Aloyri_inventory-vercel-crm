import { getAppUser } from '@/app/local-auth';
import { resolveWorkspace,AccessDenied } from '@/app/team-access';
import { roleCanExportData } from '@/lib/roles';
import { listOrderRecords } from '@/db/order-records';
import { ensureCustomerListReady } from '@/db/customer-records';
import { subtotal,total,today } from '@/lib/crm';
export const dynamic='force-dynamic';
const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
export async function GET(){try{
 const user=await getAppUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});const {ownerId,role}=await resolveWorkspace(user);if(!roleCanExportData(role))return Response.json({error:'Your role cannot export records.'},{status:403});
 const version=(await ensureCustomerListReady(ownerId)).version,lines=[['Order','Date','Customer','Channel','Status','Payment','Product revenue','Customer total','Product cost','Courier','Payment fee','Packaging','Settled'].map(cell).join(',')];
 for(let page=1;page<=50;page++){
  const result=await listOrderRecords(ownerId,{page,pageSize:200,q:'',status:'All'});if(result.workspaceVersion!==version)return Response.json({error:'Records changed during export. Please retry.'},{status:409});
  for(const o of result.orders)lines.push([o.number,o.created,result.customers?.find(c=>c.id===o.customerId)?.name||'',o.channel,o.status,o.payment,subtotal(o),total(o),o.items.flatMap(i=>i.allocations).reduce((n,a)=>n+a.qty*a.unitCost,0),o.courierCost,o.paymentFee,o.packaging,o.settled?'Yes':'No'].map(cell).join(','));
  if(page>=result.pagination!.totalPages)break;
 }
 if((await ensureCustomerListReady(ownerId)).version!==version)return Response.json({error:'Records changed during export. Please retry.'},{status:409});
 return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="aloyri-orders-'+today()+'.csv"','Cache-Control':'no-store'}});
 }catch(e){if(e instanceof AccessDenied)return Response.json({error:e.message},{status:403});return Response.json({error:'Could not export records.'},{status:503})}}
