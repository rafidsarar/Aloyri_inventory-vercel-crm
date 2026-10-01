import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { canManageBusinessSettings } from '@/lib/roles';
import { database } from '@/db/raw';
import { fixedBusinessName, stateSchema, validateRelations } from '@/lib/crm';
import { getCustomersOrdersMigrationStatus, migrateCustomersOrdersShadow } from '@/db/customer-order-shadow';
import { getInventorySupplierMigrationStatus,migrateInventorySupplierShadow } from '@/db/inventory-supplier-shadow';
import { getFinanceMigrationStatus,migrateFinanceShadow } from '@/db/finance-shadow';
import { getCutoverState,verifyRelationalParity } from '@/db/relational-cutover';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in to view migration status.'},401);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!canManageBusinessSettings(role))return response({error:'Only the owner or an admin can view migration status.'},403);
    const [customersOrders,inventorySuppliers,finances,cutover,verification]=await Promise.all([getCustomersOrdersMigrationStatus(ownerId),getInventorySupplierMigrationStatus(ownerId),getFinanceMigrationStatus(ownerId),getCutoverState(ownerId),verifyRelationalParity(ownerId)]);
    return response({domains:{customersOrders,inventorySuppliers,finances},cutover,verification});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Relational migration status failed',error);
    return response({error:'Could not load migration status.'},503);
  }
}

export async function POST(request:Request){
  try{
    const user=await getAppUser();
    if(!user)return response({error:'Sign in before running a migration.'},401);
    if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
    const {ownerId,role}=await resolveWorkspace(user);
    if(!canManageBusinessSettings(role))return response({error:'Only the owner or an admin can run this migration.'},403);

    const row=await database().prepare('SELECT data,version FROM crm_workspaces WHERE owner_id=?').bind(ownerId)
      .first<{data:string;version:number}>();
    if(!row)return response({error:'Workspace not found.'},404);

    const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
    validateRelations(state,{skipOrderNumberUniqueness:true});
    const customersOrders=await migrateCustomersOrdersShadow(ownerId,state,row.version);
    const inventorySuppliers=await migrateInventorySupplierShadow(ownerId,state,row.version);
    await migrateFinanceShadow(ownerId,state,row.version);
    const verification=await verifyRelationalParity(ownerId);
    return response({customersOrders,inventorySuppliers,finances:{sourceVersion:row.version},verification});
  }catch(error){
    if(error instanceof AccessDenied)return response({error:error.message},403);
    console.error('Relational migration failed',error);
    return response({error:error instanceof Error?error.message:'Relational migration failed.'},500);
  }
}
