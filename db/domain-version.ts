import { database } from './raw.ts';
import { ensureRelationalFoundation } from './relational-foundation.ts';

export async function getDomainVersion(ownerId:string,domain:string){
  await ensureRelationalFoundation();
  const now=new Date().toISOString(),db=database();
  await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,0,?) ON CONFLICT(owner_id,domain) DO NOTHING').bind(ownerId,domain,now).run();
  const row=await db.prepare('SELECT version FROM crm_domain_versions WHERE owner_id=? AND domain=?').bind(ownerId,domain).first<{version:number}>();
  return Number(row?.version||0);
}

export async function bumpDomainVersion(ownerId:string,domain:string,expected?:number){
  const db=database(),now=new Date().toISOString();
  if(expected===undefined){
    await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id,domain) DO UPDATE SET version=crm_domain_versions.version+1,updated_at=EXCLUDED.updated_at').bind(ownerId,domain,now).run();
  }else{
    await db.prepare('INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id,domain) DO UPDATE SET version=crm_domain_versions.version+1,updated_at=EXCLUDED.updated_at WHERE crm_domain_versions.version=?').bind(ownerId,domain,now,expected).run();
    const current=await getDomainVersion(ownerId,domain);
    if(current!==expected+1)throw new Error('DOMAIN_VERSION_CONFLICT');
  }
  return getDomainVersion(ownerId,domain);
}


export function domainVersionBumpStatements(ownerId:string,domain:string,expected:number,now=new Date().toISOString()){
  const db=database();
  return [
    db.prepare('UPDATE crm_domain_versions SET version=version+1,updated_at=? WHERE owner_id=? AND domain=? AND version=?').bind(now,ownerId,domain,expected),
    db.prepare("SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM crm_domain_versions WHERE owner_id=? AND domain=? AND version=?) THEN 1 ELSE 0 END").bind(ownerId,domain,expected+1)
  ];
}
