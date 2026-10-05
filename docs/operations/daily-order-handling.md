# Daily Order Handling SOP

## Purpose

Process website orders consistently without bypassing live stock, customer verification, collection or fulfilment controls.

## Role ownership

| Work | Primary role | Backup |
| --- | --- | --- |
| New-order review | Sales employee | Admin / Owner |
| Customer confirmation / follow-up | Sales employee | Admin / Owner |
| Picking and packing | Sales + Inventory coordination | Admin |
| Tracking reference / fulfilment status | Sales employee | Admin |
| Returned-stock inspection | Inventory manager | Admin / Owner |
| Customer collection / financial settlement | Finance manager | Admin / Owner |
| Exception approval | Owner / Admin | — |

## Start-of-day checks

Before processing the first order:

1. Confirm CRM loads normally.
2. Confirm the CRM health endpoint reports database status OK.
3. Confirm the ecommerce tracking round-trip health check is healthy.
4. Review Alerts for stock, expiry and operational exceptions.
5. Review Website return requests in Orders.
6. Confirm there are no unresolved critical inventory or finance reconciliation exceptions.
7. If ordering is intentionally disabled, do not manually create replacement Website orders on behalf of customers unless the owner explicitly decides to do so.

## New website orders

For each `New` Website order:

1. Open the order in CRM.
2. Confirm:
   - customer name and phone are present,
   - delivery address is sufficient,
   - items and quantities look plausible,
   - delivery zone/charge is correct,
   - payment method is expected,
   - the order has valid inventory allocations.
3. Do not change the selling price merely to match a customer message or screenshot.
4. If the order is valid, advance to `Confirmed`.
5. If clarification is required, contact the customer before advancing.
6. If the order cannot be fulfilled, cancel through CRM rather than deleting operational history.

## Fulfilment progression

Use the normal order progression:

1. **Confirmed** — order accepted for fulfilment.
2. **Ready to pack** — picking is complete / order is ready for packing.
3. **Packed** — parcel physically packed and verified.
4. **Shipped** — parcel handed to the delivery process/courier.
5. **Out for delivery** — courier has the parcel for final delivery.
6. **Delivered** — delivery completed.

Rules:

- Do not mark `Packed` before products are physically checked.
- Do not mark `Shipped` before courier hand-off.
- Add the courier tracking/reference when known.
- Do not mark `Delivered` merely because the courier estimated delivery.
- Status changes may create customer notification events. Notification delivery failure must not cause staff to duplicate the status change.

## COD collection

For Cash on Delivery:

1. Delivery completion and money collection are separate facts.
2. Finance records the customer collection against the appropriate account.
3. Never collect more than the outstanding balance.
4. Do not backdate payment before the configured account opening date.
5. Record a useful payment/courier reference when available.
6. The order is financially settled only when the CRM shows the required collection has been recorded.

## Order exceptions

### Customer asks to cancel before delivery

- Use the CRM cancellation path.
- Do not delete the order to hide the cancellation.
- Confirm any reserved stock is released through the supported workflow.

### Stock mismatch during fulfilment

- Stop fulfilment for that order.
- Do not substitute a product without customer approval and a valid CRM record.
- Inventory investigates batch/stock discrepancy.
- Owner/Admin handles any exceptional correction.

### Duplicate-looking orders

- Compare order number, phone, creation time and items.
- Do not delete either order until the duplicate is confirmed.
- Use idempotency/CRM history as evidence where available.

## End-of-day order check

Before finishing the day:

- No valid new order should be left unnoticed.
- Shipped orders should have tracking references where available.
- Delivered COD orders should be checked for collection status.
- Cancelled/Returned orders should not be silently deleted.
- Open Website return requests should have an owner/reviewer.
- Any unresolved order exception should be documented in CRM notes or the relevant operational record, not in a private spreadsheet.
