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
  tmp="$(mktemp)"
  sed '/^[[:space:]]*-- statement-break[[:space:]]*$/d' "$file" > "$tmp"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$tmp"
  rm -f "$tmp"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO crm_schema_migrations(version,applied_at) VALUES ('$version',now()::text);"
done
node --experimental-strip-types scripts/print-relational-foundation.ts | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgres-integration.sql
