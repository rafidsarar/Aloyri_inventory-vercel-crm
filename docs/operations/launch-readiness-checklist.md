# Launch Readiness Checklist

Use this as the final operational sign-off. Do not mark an item complete based only on implementation intent.

## 1. Infrastructure

- [ ] CRM production deployment is READY.
- [ ] Storefront production deployment is READY.
- [ ] CRM health endpoint returns 200/OK.
- [ ] Production database migration version is current.
- [ ] Known rollback candidates exist for CRM and storefront.
- [ ] CRM deployment protection remains correctly configured.
- [ ] Storefront remains publicly reachable.

## 2. Catalog & Product Experience

- [ ] Active CRM products appear on the storefront.
- [ ] Inactive CRM products do not appear.
- [ ] Selling prices match CRM.
- [ ] Available stock matches CRM customer-safe availability.
- [ ] Out-of-stock products cannot be added/checked out.
- [ ] Real product photography renders with fallback.
- [ ] Manufacturer claims/ingredients are sourced and not invented.
- [ ] Product structured data contains live offer data only when live data is available.

## 3. Cart & Checkout

- [ ] Cart survives refresh as expected.
- [ ] Cart quantity cannot exceed available stock.
- [ ] Checkout revalidates live catalog before submission.
- [ ] Inside-Dhaka delivery charge is correct.
- [ ] Outside-Dhaka delivery charge is correct.
- [ ] COD is the only enabled live payment method until payment integrations are certified.
- [ ] Duplicate/uncertain submissions do not create repeated orders.
- [ ] Checkout error states are understandable on mobile.
- [ ] Order confirmation shows the correct order reference and total.

## 4. Order Lifecycle

- [ ] Website order enters CRM as Website / New.
- [ ] Inventory allocation is created correctly.
- [ ] New → Confirmed → Ready to pack → Packed → Shipped → Out for delivery → Delivered works.
- [ ] Courier tracking reference is visible to customer when present.
- [ ] COD collection is recorded separately from delivery status.
- [ ] Cancelled orders preserve audit/history.

## 5. Tracking

- [ ] Nonexistent-order tracking smoke returns generic not-found.
- [ ] Real order + correct phone returns customer-safe details.
- [ ] Wrong phone does not reveal whether the order exists.
- [ ] Tracking does not expose address, internal notes, costs, batches or finance fields.

## 6. Returns / Refunds

- [ ] Nonexistent return-request smoke returns generic not-found.
- [ ] Delivered Website order can submit a return review.
- [ ] Requested items/quantities cannot exceed original order lines.
- [ ] Website return queue appears in CRM Orders.
- [ ] Staff can move Requested → Reviewing → Approved/Rejected → Resolved.
- [ ] Staff review note saves.
- [ ] Approval does not automatically mark order Returned.
- [ ] Approval does not automatically refund.
- [ ] Approval does not restock.
- [ ] Physical returned stock can be inspected Sellable / Quarantine / Damaged.
- [ ] Finance can record Refund / No refund / Store credit / Exchange.
- [ ] No duplicate refund is created.

## 7. Finance

- [ ] Delivered COD collections reconcile to the correct account.
- [ ] Customer refund handling uses the dedicated workflow.
- [ ] Returned-with-no-refund creates no customer cash outflow.
- [ ] Store credit is not treated as cash.
- [ ] Damaged-stock effect is visible in finance/reporting.
- [ ] Current balances/reports reconcile to operational records.

## 8. Roles & Security

- [ ] Owner workflow passes.
- [ ] Admin workflow passes.
- [ ] Sales workflow passes.
- [ ] Inventory workflow passes.
- [ ] Finance workflow passes.
- [ ] Viewer remains read-only.
- [ ] Unauthorized roles cannot edit protected sections.
- [ ] Website browser never receives CRM integration secret.
- [ ] No production secret is exposed in source/client bundles.

## 9. Customer Information

- [ ] Shipping & Delivery page reviewed.
- [ ] Returns & Refunds page reviewed.
- [ ] Privacy page reviewed.
- [ ] Terms page reviewed.
- [ ] FAQ reviewed.
- [ ] Contact page does not publish a fake/unverified branded email.
- [ ] Support team has the customer-service scripts.

## 10. Notifications

- [ ] Notification outbox health works.
- [ ] Order/status events queue correctly.
- [ ] Provider delivery remains disabled until an Aloyri domain is verified.
- [ ] After domain verification: SPF/DKIM/DMARC and sender identity are confirmed before enabling production email.
- [ ] One controlled real email test passes before customer-wide activation.

## 11. Analytics / Performance / Accessibility

- [ ] Analytics endpoint cannot break storefront actions.
- [ ] Analytics excludes customer identity/order number/free text.
- [ ] Do Not Track suppresses storefront analytics.
- [ ] Customer analytics opt-out works.
- [ ] LCP, CLS, INP and TTFB reporting does not cause runtime errors.
- [ ] Product images use optimized delivery.
- [ ] Skip-to-content works.
- [ ] Keyboard focus is visible.
- [ ] Mobile menu traps focus and closes with Escape.
- [ ] Reduced-motion preference is honored.
- [ ] Checkout errors are announced to assistive technology.
- [ ] Key tap targets are at least approximately 44px.

## 12. Operations & Recovery

- [ ] Daily order SOP assigned to Sales/Admin.
- [ ] Return SOP assigned to Sales/Inventory/Finance roles.
- [ ] Inventory reconciliation owner assigned.
- [ ] Incident owner/escalation path assigned.
- [ ] Backup/recovery readiness has been recently checked.
- [ ] Staff know how to stop order intake if checkout becomes unsafe.
- [ ] No critical unresolved reconciliation exceptions remain.

## Domain-dependent finalization

These can remain pending until the Aloyri domain is purchased:

- [ ] Custom Aloyri domain connected.
- [ ] Canonical/base URL updated to the custom domain.
- [ ] Resend domain verified.
- [ ] Branded transactional sender activated.
- [ ] SPF/DKIM/DMARC verified.
- [ ] Search Console connected.
- [ ] Final branded-domain SEO crawl completed.

## Sign-off

- Business owner: __________________
- Operations/Admin: ________________
- Inventory: _______________________
- Finance: _________________________
- Release date: ____________________
- CRM commit: ______________________
- Storefront commit: _______________
- Decision: **GO / CONDITIONAL GO / NO-GO**
