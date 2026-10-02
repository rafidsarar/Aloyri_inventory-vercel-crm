import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { database } from '../db/raw.ts';
import { ensureRelationalFoundation } from '../db/relational-foundation.ts';
import { runLegacyDataCertification } from './canonicalize-legacy-data.ts';

const db=database();
const now=()=>new Date().toISOString();

function migrationFiles(){
  return readdirSync(new URL('../sql/migrations/',import.meta.url))
    .filter(name=>/^\d+_.+\.sql$/.test(name))
    .sort();
}
function statements(sql:string){
  return sql.split(/^\s*-- statement-break\s*$/m)
    .map(part=>part.replace(/^\s*--.*$/gm,'').trim())
    .filter(Boolean);
}

await db.prepare('CREATE TABLE IF NOT EXISTS crm_schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)').run();
const applied=await db.prepare('SELECT version FROM crm_schema_migrations').all<{version:string}>();
const done=new Set(applied.results.map(row=>row.version));

for(const file of migrationFiles()){
  const version=file.replace(/\.sql$/,'');
  if(done.has(version))continue;
  const sql=readFileSync(join(new URL('../sql/migrations/',import.meta.url).pathname,file),'utf8');
  const batch=statements(sql).map(statement=>db.prepare(statement));
  batch.push(db.prepare('INSERT INTO crm_schema_migrations (version,applied_at) VALUES (?,?)').bind(version,now()));
  await db.batch(batch);
  console.log('Applied migration',version);
}

// Relational foundation is idempotent and is prepared during deployment so
// request handlers do not need to be the first place schema is discovered.
await ensureRelationalFoundation();
await runLegacyDataCertification();

const latest=await db.prepare('SELECT version FROM crm_schema_migrations ORDER BY version DESC LIMIT 1').first<{version:string}>();
console.log('Database migrations ready',latest?.version||'baseline');
