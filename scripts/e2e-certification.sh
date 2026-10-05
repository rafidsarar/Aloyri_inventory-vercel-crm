#!/usr/bin/env bash
set -euo pipefail
: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1
pnpm db:migrate
node --experimental-strip-types scripts/e2e-seed.ts
pnpm exec next build
pnpm add --save-dev --lockfile=false @playwright/test@1.55.0
pnpm exec playwright install chromium
E2E_PRODUCTION_BUILD=1 pnpm exec playwright test
mkdir -p e2e-out
printf '%s\n' 'PASS' > e2e-out/index.html
