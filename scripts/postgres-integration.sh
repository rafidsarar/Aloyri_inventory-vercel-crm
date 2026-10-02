#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS crm_schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);"
for file in $(find sql/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
  version="$(basename "$file" .sql)"
  applied="$(psql "$DATABASE_URL" -Atqc "SELECT 1 FROM crm_schema_migrations WHERE version='$version'")"
  if [[ "$applied" == "1" ]]; then
    continue
  fi
  if [[ "$version" == "007_legacy_date_canonicalization" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO crm_workspaces(owner_id,data,version,updated_at)
VALUES (
  'legacy-date-owner',
  '{
    "businessName":"ALOYRI",
    "customers":[{"id":"c1","created":"2026-09-30T18:00:00.000Z"}],
    "purchaseOrders":[{"id":"po1","created":"2026-09-28T00:00:00.000Z","expected":"2026-10-05T00:00:00+06:00"}],
    "batches":[{"id":"b1","expiry":"2027-10-01T00:00:00.000Z","received":"2026-09-29T12:00:00.000Z","dueDate":"2026-10-29T00:00:00.000Z","paidAt":"","payments":[{"id":"p1","date":"2026-09-30T00:00:00.000Z"}]}],
    "stockAdjustments":[{"id":"a1","date":"2026-09-30T00:00:00.000Z"}],
    "inventoryHolds":[{"id":"h1","date":"2026-10-01T00:00:00.000Z","releasedAt":""}],
    "orders":[{"id":"o1","created":"2026-09-30T00:00:00.000Z","delivered":"","collections":[{"id":"col1","date":"2026-10-01T00:00:00.000Z"}]}],
    "expenses":[{"id":"e1","date":"2026-09-30T00:00:00.000Z"}],
    "cashEntries":[{"id":"cash1","date":"2026-09-30T00:00:00.000Z"}],
    "accountOpenings":[{"account":"cash","date":"2026-01-01T00:00:00.000Z","statementDate":""}],
    "financeCloses":[{"month":"2026-09","closedAt":"2026-09-30T00:00:00.000Z"}],
    "tasks":[{"id":"t1","due":"2026-10-02T00:00:00.000Z","completedAt":""}]
  }',
  41,
  now()::text
)
ON CONFLICT(owner_id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at;
SQL
  fi
  tmp="$(mktemp)"
  sed '/^[[:space:]]*-- statement-break[[:space:]]*$/d' "$file" > "$tmp"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$tmp"
  rm -f "$tmp"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO crm_schema_migrations(version,applied_at) VALUES ('$version',now()::text);"
done
node --experimental-strip-types scripts/print-relational-foundation.ts | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO crm_workspaces(owner_id,data,version,updated_at) VALUES ('legacy-owner','{}',0,now()::text) ON CONFLICT(owner_id) DO NOTHING;"
tmp="$(mktemp)"
sed '/^[[:space:]]*-- statement-break[[:space:]]*$/d' sql/migrations/005_domain_version_backfill.sql > "$tmp"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$tmp"
rm -f "$tmp"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgres-integration.sql
