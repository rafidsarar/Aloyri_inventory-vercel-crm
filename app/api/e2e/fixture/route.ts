import { initialState } from '@/lib/crm';
import { visibleState } from '@/lib/role-data';
import type { WorkspaceRole } from '@/lib/roles';

export const dynamic='force-dynamic';

const roles=new Set<WorkspaceRole>(['owner','admin','sales','inventory','finance','viewer']);

export async function GET(request:Request){
  if(process.env.E2E_TEST_MODE!=='1')return Response.json({error:'Not found.'},{status:404});
  const requested=new URL(request.url).searchParams.get('role') as WorkspaceRole|null;
  const role=requested&&roles.has(requested)?requested:'viewer';
  const data=visibleState(initialState(),role);
  return Response.json({
    workspace:{data,version:1,role,userName:'E2E '+role,recoveryMode:false},
    customers:{customers:data.customers.map(customer=>({...customer,recordVersion:0}))},
    orders:{orders:data.orders.map(order=>({...order,recordVersion:0}))},
    inventory:{data:{
      products:data.products,productCategories:data.productCategories,suppliers:data.suppliers,
      purchaseOrders:data.purchaseOrders,batches:data.batches,stockAdjustments:data.stockAdjustments,
      inventoryHolds:data.inventoryHolds
    },domainVersion:1},
    finance:{data:{
      expenses:data.expenses,cashEntries:data.cashEntries,accountOpenings:data.accountOpenings,
      accountMatches:data.accountMatches,financeCloses:data.financeCloses
    },domainVersion:1}
  },{headers:{'Cache-Control':'no-store'}});
}
