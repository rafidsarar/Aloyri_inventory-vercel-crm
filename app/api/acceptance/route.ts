import { database } from '@/db/raw';

export const dynamic='force-dynamic';

const headers={'Cache-Control':'no-store, max-age=0','Content-Type':'application/json; charset=utf-8'};

type Row={
  workspace_count:string|number;
  disabled_cutovers:string|number;
  unverified_domains:string|number;
  missing_domain_versions:string|number;
  restore_snapshots:string|null;
  audit_log:string|null;
  security_events:string|null;
  backup_events:string|null;
};

export async function GET(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null;
  try{
    const row=await database().prepare(`
      SELECT
        (SELECT COUNT(*) FROM crm_workspaces) AS workspace_count,
        (SELECT COUNT(*) FROM crm_relational_cutover WHERE enabled=FALSE) AS disabled_cutovers,
        (SELECT COUNT(*) FROM crm_relational_migrations WHERE status<>'verified') AS unverified_domains,
        (SELECT COUNT(*) FROM crm_workspaces w
          WHERE NOT EXISTS (SELECT 1 FROM crm_domain_versions d WHERE d.owner_id=w.owner_id AND d.domain='customers-orders')
             OR NOT EXISTS (SELECT 1 FROM crm_domain_versions d WHERE d.owner_id=w.owner_id AND d.domain='inventory-suppliers')
             OR NOT EXISTS (SELECT 1 FROM crm_domain_versions d WHERE d.owner_id=w.owner_id AND d.domain='finances')
        ) AS missing_domain_versions,
        to_regclass('public.crm_restore_snapshots')::text AS restore_snapshots,
        to_regclass('public.crm_audit_log')::text AS audit_log,
        to_regclass('public.crm_security_events')::text AS security_events,
        to_regclass('public.crm_backup_events')::text AS backup_events
    `).first<Row>();
    const checks={
      workspaceReady:Number(row?.workspace_count||0)>0,
      cutoverReady:Number(row?.disabled_cutovers||0)===0,
      relationalDomainsReady:Number(row?.unverified_domains||0)===0,
      domainVersionsReady:Number(row?.missing_domain_versions||0)===0,
      restoreInfrastructureReady:Boolean(row?.restore_snapshots&&row?.audit_log),
      securityInfrastructureReady:Boolean(row?.security_events),
      recoveryTrackingReady:Boolean(row?.backup_events)
    };
    const ok=Object.values(checks).every(Boolean);
    return Response.json({status:ok?'ok':'unavailable',commit,checks},{status:ok?200:503,headers});
  }catch(error){
    console.error('Production acceptance check failed',error);
    return Response.json({status:'unavailable',commit,checks:null},{status:503,headers});
  }
}
