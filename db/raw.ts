import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

// Compatibility layer for the existing parameterized CRM queries. Production
// uses Neon HTTP. Authenticated E2E CI can opt into the runner's local
// PostgreSQL service without changing production database behavior.
type Row = Record<string, unknown>;
type QueryResult<T> = { rows: T[]; rowCount: number };
const execFileAsync=promisify(execFile);

function statementSql(source: string) {
  let index = 0;
  let sql = source.replace(/\?/g, () => `$${++index}`);
  if (/^INSERT OR IGNORE INTO /i.test(sql)) {
    sql = sql.replace(/^INSERT OR IGNORE INTO /i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING';
  }
  return sql;
}

function databaseUrl(){
  const url=process.env.SKINVENTORY_DB_DATABASE_URL || process.env.DATABASE_URL;
  if(!url)throw new Error('A Neon database URL is not configured.');
  return url;
}

function sqlLiteral(value:unknown){
  if(value===null||value===undefined)return 'NULL';
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Invalid numeric SQL parameter.');
    return String(value);
  }
  if(typeof value==='boolean')return value?'TRUE':'FALSE';
  return "'"+String(value).replaceAll("'","''")+"'";
}

function boundSql(source:string,values:unknown[]){
  return source.replace(/\$(\d+)/g,(_match,index)=>sqlLiteral(values[Number(index)-1]));
}

function localPostgresEnabled(){return process.env.E2E_LOCAL_POSTGRES==='1'}

async function localSelect(sql:string,values:unknown[]):Promise<QueryResult<Row>>{
  const query=boundSql(sql,values).replace(/;\s*$/,'');
  const wrapper=`SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM (${query}) q`;
  const {stdout}=await execFileAsync('psql',[databaseUrl(),'-X','-v','ON_ERROR_STOP=1','-At','-c',wrapper],{maxBuffer:16*1024*1024});
  const raw=stdout.trim()||'[]';
  const rows=JSON.parse(raw) as Row[];
  return {rows,rowCount:rows.length};
}

async function localRun(sql:string,values:unknown[]):Promise<QueryResult<Row>>{
  const query=boundSql(sql,values);
  const {stdout}=await execFileAsync('psql',[databaseUrl(),'-X','-v','ON_ERROR_STOP=1','-c',query],{maxBuffer:16*1024*1024});
  const tags=[...stdout.matchAll(/(?:INSERT\s+\d+\s+(\d+)|UPDATE\s+(\d+)|DELETE\s+(\d+)|MERGE\s+(\d+))/g)];
  const last=tags.at(-1);
  const rowCount=last?Number(last.slice(1).find(Boolean)||0):0;
  return {rows:[],rowCount};
}

class Statement {
  values: unknown[] = [];
  readonly sql: string;
  constructor(source: string) { this.sql = statementSql(source); }
  bind(...values: unknown[]) { this.values = values; return this; }
  async query(sql = client()) {
    if(localPostgresEnabled()){
      if(/^\s*(SELECT|WITH)\b/i.test(this.sql))return localSelect(this.sql,this.values);
      return localRun(this.sql,this.values);
    }
    return sql.query(this.sql, this.values, { fullResults: true }) as Promise<QueryResult<Row>>;
  }
  async first<T>() { const result = await this.query(); return (result.rows[0] ?? null) as T | null; }
  async all<T>() { const result = await this.query(); return { results: result.rows as T[] }; }
  async run() { const result = await this.query(); return { meta: { changes: result.rowCount } }; }
}

function client() { return neon(databaseUrl()); }

export function database() {
  return {
    prepare: (query: string) => new Statement(query),
    batch: async (statements: Statement[]) => {
      if(localPostgresEnabled()){
        const sql='BEGIN;\n'+statements.map(statement=>boundSql(statement.sql,statement.values).replace(/;\s*$/,'')+';').join('\n')+'\nCOMMIT;';
        await execFileAsync('psql',[databaseUrl(),'-X','-v','ON_ERROR_STOP=1','-c',sql],{maxBuffer:32*1024*1024});
        return statements.map(()=>({meta:{changes:0}}));
      }
      const sql = client();
      const results = await sql.transaction(tx => statements.map(s => tx.query(s.sql, s.values)), { fullResults: true });
      return results.map(result => ({ meta: { changes: result.rowCount } }));
    },
  };
}
