#!/usr/bin/env bash
set -euo pipefail
: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1

echo "==> migration isolation check"
pnpm db:migrate

mkdir -p e2e-out
printf '%s\n' '<!doctype html><title>Aloyri E2E</title><h1>migration: PASS</h1>' > e2e-out/index.html
printf '%s\n' '{"stage":"migration","status":"PASS"}' > e2e-out/status.json
