#!/usr/bin/env bash
set -euo pipefail

if [ -z "${E2E_DATABASE_URL:-}" ]; then
  echo "E2E_DATABASE_URL is not configured for this preview."
  exit 1
fi

export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1

echo "==> Applying migrations to isolated E2E database"
pnpm db:migrate

echo "==> Seeding authenticated six-role E2E workspace"
node --experimental-strip-types scripts/e2e-seed.ts

echo "==> Installing Playwright test runner"
pnpm add --save-dev --lockfile=false @playwright/test@1.55.0

echo "==> Building CRM"
pnpm build

echo "==> Installing Chromium"
pnpm exec playwright install chromium

echo "==> Running destructive authenticated E2E certification"
E2E_PRODUCTION_BUILD=1 pnpm exec playwright test
