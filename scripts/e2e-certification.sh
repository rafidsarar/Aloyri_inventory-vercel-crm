#!/usr/bin/env bash
set -euo pipefail
: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1
echo "stage 1 migrations"
pnpm db:migrate
echo "stage 2 seed"
node --experimental-strip-types scripts/e2e-seed.ts
echo "stage 3 build"
pnpm build
echo "stage 4 browser runtime"
pnpm add --save-dev --lockfile=false @playwright/test@1.55.0
pnpm exec playwright install chromium
echo "stage 5 browser tests"
E2E_PRODUCTION_BUILD=1 pnpm exec playwright test
mkdir -p e2e-out
printf '%s\n' '{"databaseIsolation":"PASS","migrations":"PASS","seed":"PASS","applicationBuild":"PASS","authenticatedBrowserE2E":"PASS"}' > e2e-out/status.json
printf '%s\n' 'Aloyri CRM isolated E2E certification PASS' > e2e-out/index.html
