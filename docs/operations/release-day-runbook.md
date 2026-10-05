# Release / Launch-Day Runbook

## Rule

A release is not “done” because Vercel says READY. The release is complete only after business workflows are verified against the live production deployment.

## Before deployment

- Confirm intended CRM commit and storefront commit.
- Confirm migrations are additive/reviewed.
- Confirm no required secret is missing.
- Confirm CRM protection remains configured as intended.
- Confirm the customer storefront is public.
- Confirm COD remains the only live payment method unless a separate payment rollout has been certified.
- Confirm the notification provider is disabled until a verified Aloyri sending domain exists.
- Confirm there is a known rollback candidate.

## Deploy CRM first

For changes that affect Website→CRM behavior:

1. deploy CRM first,
2. wait for READY,
3. confirm CRM health endpoint,
4. confirm reported migration version,
5. run integration health checks,
6. only then deploy/merge the storefront dependency.

Never make the website depend on an API that is not yet live.

## CRM production acceptance

Verify:

- sign-in,
- role access,
- Overview,
- Orders,
- Customers,
- Inventory,
- Suppliers/Purchasing,
- Finance,
- Website return-request queue,
- audit/history for Owner/Admin,
- health endpoints.

For the return-request release specifically:

- migration `013_ecommerce_return_requests` present,
- Orders workspace loads the Website return queue,
- roles without Orders access cannot view it,
- roles without order-edit permission cannot mutate it.

## Website production acceptance

Verify on mobile and desktop:

- home,
- shop,
- category pages,
- product pages,
- product images,
- live price/stock,
- cart quantity limits,
- checkout,
- COD review,
- order confirmation,
- order tracking,
- returns/refunds page,
- return-request flow,
- customer-care/legal pages,
- robots/sitemap.

## Safe integration tests

Prefer non-destructive tests where possible.

### Tracking

Use a deliberately nonexistent order and expect the generic `TRACKING_NOT_FOUND` behavior through the full Website→CRM round trip.

### Return requests

For authentication-path testing, use a deliberately nonexistent Website order and test phone. Expect a generic not-found response. This proves the signed bridge without creating a return record.

A successful return request should only be tested against a real eligible Delivered order with the correct customer phone. Do not manufacture a fake Delivered business order just for the smoke test unless explicitly approved.

### Order creation

A successful Website order reserves real stock. Do not create one casually for smoke testing. Use invalid/nonexistent product tests for bridge/auth validation unless an intentional real test order is approved.

## Post-deploy checks

- No unexpected error spike.
- No duplicate order activity.
- No unexpected stock allocation movement.
- No failed migration warning.
- Tracking bridge healthy.
- Return bridge responds safely.
- Analytics endpoint returns no-content and does not affect checkout.
- Customer privacy fields are absent from analytics payloads.
- Performance observers do not break unsupported browsers.
- Keyboard navigation remains usable.
- Mobile navigation traps focus and closes with Escape.

## Final go/no-go

### GO

All critical workflows pass and no unresolved P1/P2 issue exists.

### CONDITIONAL GO

Only documented non-critical issues remain and there is a safe workaround that does not compromise customer data, stock, order integrity or finance.

### NO-GO

Any of:

- database unhealthy,
- order creation corrupt/duplicating,
- price/stock authority mismatch,
- return/refund workflow changes money or stock incorrectly,
- unauthorized role access,
- checkout cannot reliably submit,
- production rollback path is unknown.
