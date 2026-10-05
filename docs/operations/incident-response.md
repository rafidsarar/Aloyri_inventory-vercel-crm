# Incident Response & Rollback

## Severity

### P1 — Critical

Examples:

- CRM unavailable for all staff
- storefront unavailable for customers
- database health unavailable
- checkout creates corrupt/duplicate orders
- unauthorized access or suspected credential exposure
- incorrect stock/refund behavior affecting multiple records

### P2 — Major

Examples:

- checkout cannot create orders
- Website→CRM catalog sync fails
- order tracking fails
- return-request bridge fails
- one critical role cannot perform required work
- customer notification queue repeatedly fails after sender activation

### P3 — Minor

Examples:

- isolated UI defect
- cosmetic layout issue
- non-critical analytics/SEO problem
- one optional workflow has a workaround that does not compromise data integrity

## First response

1. Stop making speculative production changes.
2. Identify:
   - affected system,
   - first known failure time,
   - latest production deployment/commit,
   - whether data has already been written incorrectly.
3. Check CRM health.
4. Check storefront/CRM integration health where available.
5. Check Vercel deployment state and runtime logs.
6. Preserve screenshots/logs/record references needed for diagnosis.

## If checkout/order creation is unsafe

Use the existing storefront ordering feature flag to disable ordering rather than letting customers submit into a broken path.

The storefront may remain browseable while order intake is disabled.

Do not solve a broken integration by exposing CRM endpoints directly to the browser.

## If CRM is unhealthy

- Stop staff writes until the database/integration state is understood.
- Do not repeatedly retry financial or stock actions if the response is ambiguous.
- Use record/version conflict handling rather than force-overwriting data.

## Rollback

Rollback is appropriate when:

- the immediately previous READY deployment is known healthy,
- the issue is introduced by the current application release,
- rolling back code will not conflict with a destructive schema/data migration.

Before rollback:

1. identify current and previous commits,
2. inspect migration compatibility,
3. confirm no new business record depends on code that will disappear,
4. record the rollback reason.

After rollback:

1. verify CRM health,
2. verify website health,
3. verify catalog sync,
4. run a safe tracking probe,
5. verify order creation with a non-destructive test when possible,
6. reconcile any business records written during the incident window.

## Database rule

Do not manually edit production database rows as the first response.

If a data correction is required:

- identify exact affected records,
- take/verify backup/recovery readiness,
- use a reviewed migration or supported CRM workflow,
- record what changed,
- run reconciliation afterward.

## Security incident

If a secret may be exposed:

1. disable/revoke it,
2. rotate the secret,
3. update Vercel environment variables,
4. redeploy,
5. inspect relevant access/request logs,
6. invalidate sessions if account access could be affected.

Never paste production secrets into support tickets, screenshots or chat messages.

## Customer communication

Communicate only confirmed facts.

Good:

> We’re currently unable to accept new orders while we verify an operational issue. Existing customer data and orders are being reviewed, and we’ll restore checkout after verification.

Avoid:

> Everything is safe / nothing was affected

unless that has actually been verified.

## Incident closure

An incident is closed only after:

- root cause is understood,
- production is stable,
- affected records are reconciled,
- customer-impact actions are complete,
- regression coverage is added where appropriate,
- the fix is documented.
