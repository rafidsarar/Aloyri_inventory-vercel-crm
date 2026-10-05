# Aloyri Operations Handbook

This handbook is the internal operating reference for Aloyri's website + CRM workflow.

It is intentionally **not** a customer-facing UI feature and must not be used as a visible development-stage label.

## Operating principles

1. **CRM is the operational source of truth.**
   - Product selling price, active status and available stock are authoritative in CRM.
   - Website orders must enter CRM through the signed ecommerce integration.
   - Staff should not create parallel spreadsheets for live order, stock or refund state.

2. **Never let communication failures block business records.**
   - Orders and status changes are committed before notification delivery.
   - Notification failures are retried separately.
   - Until the Aloyri sending domain is verified, email delivery remains intentionally disabled.

3. **Returns, stock inspection and customer settlement are separate decisions.**
   - A website return request is only a request for review.
   - Approving the request does not mark stock returned.
   - Physical returned stock is inspected separately as Sellable, Quarantine or Damaged.
   - Finance separately records Refund, No refund, Store credit or Exchange settlement.
   - Never restock a returned product before physical inspection.

4. **Use role boundaries.**
   - Sales handles customers and order fulfilment.
   - Inventory handles stock, batches, suppliers and physical return inspection.
   - Finance handles collections, refund settlement, cashflow and reconciliation.
   - Owner/Admin coordinate exceptions and have broader authority.
   - Viewer is read-only.

5. **Do not bypass failed controls.**
   - If checkout, integration authentication, stock validation or database health fails, stop the affected workflow and investigate.
   - Do not manually manufacture successful orders, payments, refunds or stock movements to “make the numbers match.”

## Handbook

- [Daily Order Handling](./daily-order-handling.md)
- [Customer Support Workflow & Scripts](./customer-support.md)
- [Returns & Refunds SOP](./returns-refunds.md)
- [Inventory Reconciliation](./inventory-reconciliation.md)
- [Incident Response & Rollback](./incident-response.md)
- [Release / Launch-Day Runbook](./release-day-runbook.md)
- [Launch Readiness Checklist](./launch-readiness-checklist.md)

## Current order lifecycle

Website fulfilment statuses:

`New → Confirmed → Ready to pack → Packed → Shipped → Out for delivery → Delivered`

Terminal/exception paths:

`Cancelled` or `Returned`

Website customer return-request review:

`Requested → Reviewing → Approved / Rejected → Resolved`

These are separate workflows. An approved website return request is not the same thing as a Returned order, inspected inventory or a completed refund.
