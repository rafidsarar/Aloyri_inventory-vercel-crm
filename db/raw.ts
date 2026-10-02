import { neon } from '@neondatabase/serverless';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);

// Compatibility layer for the existing parameterized CRM queries. All SQL is
// application-owned; user input is always sent as a separate parameter.
type Row = Record<string, unknown>;
type QueryResult<T> = { rows: T[]; rowCount: number };

function statementSql(source: string) {
  let index = 0;
  let sql = source.replace(/\?/g, () => `$${++index}`);
  if (/^INSERT OR IGNORE INTO /i.test(sql)) {
    sql = sql.replace(/^INSERT OR IGNORE INTO /i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING';
  }
  return sql;
}

function databaseUrl(){
  const url=process.env.SKINVENTORY_DB_DATABASE_URL||process.env.DATABASE_URL;
  if(!url)throw new Error('A Neon database URL is not configured.');
  return url;
}
const localPostgres=()=>process.env.E2E_LOCAL_POSTGRES==='1'&&/^postgres(?:ql)?:\/\/(?:[^@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl());

function sqlLiteral(value:unknown){
  if(value==null)return 'NULL';
  if(typeof value==='boolean')return value?'TRUE':'FALSE';
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Non-finite SQL number.');
    return String(value);
  }
  return "'"+String(value).replace(/'/g,"''")+"'";
}
function bindLocal(sql:string,values:unknown[]){
  return sql.replace(/\$(\d+)/g,(_match,n)=>sqlLiteral(values[Number(n)-1]));
}
async function localSelect(sql:string,values:unknown[]):Promise<QueryResult<Row>>{
  const wrapped=`SELECT COALESCE(json_agg(q),'[]'::json)::text FROM (${bindLocal(sql,values)}) q;`;
  const result=await execFileAsync('psql',[databaseUrl(),'-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-c',wrapped],{maxBuffer:16*1024*1024});
  const rows=JSON.parse(result.stdout.trim()||'[]') as Row[];
  return {rows,rowCount:rows.length};
}
async function localRun(sql:string,values:unknown[]):Promise<QueryResult<Row>>{
  const result=await execFileAsync('psql',[databaseUrl(),'-X','-t','-A','-v','ON_ERROR_STOP=1','-c',bindLocal(sql,values)],{maxBuffer:16*1024*1024});
  const tag=result.stdout.trim().split(/\r?\n/).at(-1)||'';
  const match=tag.match(/^(?:INSERT\s+\d+\s+|UPDATE\s+|DELETE\s+)(\d+)$/i);
  return {rows:[],rowCount:match?Number(match[1]):0};
}

class Statement {
  values: unknown[] = [];
  readonly sql: string;
  constructor(source: string) { this.sql = statementSql(source); }
  bind(...values: unknown[]) { this.values = values; return this; }
  query(sql = client()) {
    if(localPostgres()){
      return /^\s*(SELECT|WITH|SHOW)\b/i.test(this.sql)?localSelect(this.sql,this.values):localRun(this.sql,this.values);
    }
    return sql.query(this.sql, this.values, { fullResults: true }) as Promise<QueryResult<Row>>;
  }
  async first<T>() { const result = await this.query(); return (result.rows[0] ?? null) as T | null; }
  async all<T>() { const result = await this.query(); return { results: result.rows as T[] }; }
  async run() { const result = await this.query(); return { meta: { changes: result.rowCount } }; }
}
function client() {
  return neon(databaseUrl());
}

async function localBatch(statements:Statement[]){
  const body=statements.map(statement=>bindLocal(statement.sql,statement.values).replace(/;\s*$/,'')+';').join('\n');
  await execFileAsync('psql',[databaseUrl(),'-X','-q','-v','ON_ERROR_STOP=1','-c','BEGIN;\n'+body+'\nCOMMIT;'],{maxBuffer:32*1024*1024});
  return statements.map(()=>({meta:{changes:1}}));
}

export function database() {
  return {
    prepare: (query: string) => new Statement(query),
    batch: async (statements: Statement[]) => {
      if(localPostgres())return localBatch(statements);
      const sql = client();
      const results = await sql.transaction(tx => statements.map(s => tx.query(s.sql, s.values)), { fullResults: true });
      return results.map(result => ({ meta: { changes: result.rowCount } }));
    },
  };
}
