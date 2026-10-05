#!/usr/bin/env bash
set -euo pipefail

: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1

echo "==> E2E stage 1: migrations"
pnpm db:migrate

echo "==> E2E stage 1: authenticated six-role seed"
node --experimental-strip-types scripts/e2e-seed.ts

echo "==> E2E stage 1: application verification/build"
pnpm build
