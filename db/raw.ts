import { neon } from '@neondatabase/serverless';

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
  // PostgreSQL requires a target for UPSERT; existing query supplies one.
  return sql;
}
class Statement {
  values: unknown[] = [];
  readonly sql: string;
  constructor(source: string) { this.sql = statementSql(source); }
  bind(...values: unknown[]) { this.values = values; return this; }
  query(sql = client()) {
    return sql.query(this.sql, this.values, { fullResults: true }) as Promise<QueryResult<Row>>;
  }
  async first<T>() { const result = await this.query(); return (result.rows[0] ?? null) as T | null; }
  async all<T>() { const result = await this.query(); return { results: result.rows as T[] }; }
  async run() { const result = await this.query(); return { meta: { changes: result.rowCount } }; }
}
function client() {
  const url = process.env.SKINVENTORY_DB_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('A Neon database URL is not configured.');
  return neon(url);
}
export function database() {
  return {
    prepare: (query: string) => new Statement(query),
    // Neon runs this array in one transaction. Keep the caller's D1 batch API.
    batch: async (statements: Statement[]) => {
      const sql = client();
      const results = await sql.transaction(tx => statements.map(s => tx.query(s.sql, s.values)), { fullResults: true });
      return results.map(result => ({ meta: { changes: result.rowCount } }));
    },
  };
}
