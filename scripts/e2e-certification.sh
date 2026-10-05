#!/usr/bin/env bash
set -euo pipefail
: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"
export DATABASE_URL="$E2E_DATABASE_URL"
export E2E_TEST_MODE=1
echo "==> migration isolation check"
pnpm db:migrate
echo "==> build after migration"
pnpm build
