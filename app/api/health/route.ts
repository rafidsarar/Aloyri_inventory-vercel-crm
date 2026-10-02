import { database } from '@/db/raw';

export const dynamic='force-dynamic';

const headers={
  'Cache-Control':'no-store, max-age=0',
  'Content-Type':'application/json; charset=utf-8'
};
const MIN_MIGRATION='003_finance_manager_role';

type SchemaHealth={
  ok:number;
  role_check:string|null;
  migration_version:string|null;
  rel_orders:string|null;
  rel_products:string|null;
  rel_finance:string|null;
  domain_versions:string|null;
};

export async function GET(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null;
  try{
    const result=await database().prepare(`
      SELECT
        1 AS ok,
        (SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid='crm_users'::regclass AND conname='crm_users_role_check') AS role_check,
        (SELECT version FROM crm_schema_migrations ORDER BY version DESC LIMIT 1) AS migration_version,
        to_regclass('public.crm_rel_orders')::text AS rel_orders,
        to_regclass('public.crm_rel_products')::text AS rel_products,
        to_regclass('public.crm_rel_finance_cash_entries')::text AS rel_finance,
        to_regclass('public.crm_domain_versions')::text AS domain_versions
    `).first<SchemaHealth>();
    if(result?.ok!==1)throw new Error('Database health check failed.');
    if(!result.role_check?.toLowerCase().includes('finance'))throw new Error('Workspace role schema is outdated.');
    if(!result.migration_version||result.migration_version.localeCompare(MIN_MIGRATION)<0)throw new Error('Database migrations are incomplete.');
    if(!result.rel_orders||!result.rel_products||!result.rel_finance||!result.domain_versions)throw new Error('Relational schema is incomplete.');
    return Response.json({
      status:'ok',
      commit,
      database:{status:'ok',migrationVersion:result.migration_version,relationalSchema:'ok'}
    },{status:200,headers});
  }catch(error){
    console.error('Health check failed',error);
    return Response.json({status:'unavailable',commit,database:{status:'unavailable'}},{status:503,headers});
  }
}
