import { relationalFoundationSql } from '../db/relational-foundation.ts';

for(const statement of relationalFoundationSql)
  process.stdout.write(statement.trim().replace(/;\s*$/,'')+';\n');
