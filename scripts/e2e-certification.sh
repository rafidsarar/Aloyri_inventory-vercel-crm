#!/usr/bin/env bash
set -euo pipefail
: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1

echo "==> authenticated six-role seed"
node --experimental-strip-types scripts/e2e-seed.ts

mkdir -p e2e-out
printf '%s\n' '<!doctype html><title>Aloyri E2E</title><h1>seed: PASS</h1>' > e2e-out/index.html
printf '%s\n' '{"stage":"seed","status":"PASS"}' > e2e-out/status.json
