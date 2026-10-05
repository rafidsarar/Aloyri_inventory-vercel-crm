# Inventory Reconciliation SOP

## Goal

Keep CRM available stock, physical stock, return holds and supplier receipts aligned without hiding discrepancies through manual edits.

## Daily checks

Inventory manager should review:

- low-stock and expiry alerts,
- new received purchase orders/batches,
- Website orders awaiting fulfilment,
- returned products awaiting physical inspection,
- Quarantine/Damaged holds,
- suspicious stock adjustments,
- batches with unexpected available quantity.

## Physical vs CRM stock

For each discrepancy:

1. Identify the product and batch.
2. Count physical sellable units.
3. Check:
   - received purchase quantity,
   - active order allocations,
   - cancellations/returns,
   - inventory holds,
   - prior stock adjustments,
   - expiry state.
4. Determine the actual reason before posting an adjustment.
5. Use the smallest supported correction that accurately represents reality.
6. Document the reason clearly.

Never post a stock adjustment only to make a dashboard warning disappear.

## Returned stock

Returned items must not go directly back to sellable stock.

Required sequence:

`Returned order → physical inspection → Sellable / Quarantine / Damaged`

If Quarantine or Damaged, ensure the hold is visible under Holds & Returns.

## Purchase receipts

When receiving stock:

- match the supplier/purchase order,
- verify product,
- verify quantity,
- record batch identity,
- record unit cost,
- record expiry where required,
- confirm received quantity only after physical receipt.

Do not invent a received batch merely to resolve an order allocation problem.

## Batch exceptions

When an allocation references an unexpected or legacy batch:

1. inspect the order allocation,
2. inspect the underlying purchase/receiving history,
3. verify remaining quantity,
4. link/correct only with evidence,
5. re-run reconciliation.

Unlinked or legacy records should be investigated; they should not be silently deleted just because they are old.

## Expiry handling

- Do not allocate expired stock.
- Hold/remove stock that should not be sold.
- Keep expiry-related losses separate from customer refunds.
- Reconcile physical disposal/damage with the appropriate inventory hold/adjustment record.

## Weekly reconciliation

At least weekly:

1. Compare CRM product availability with physical counts for high-volume SKUs.
2. Review all open inventory holds.
3. Review all return inspections.
4. Review recent stock adjustments.
5. Review purchase receipts and batch costs.
6. Check whether any order allocation exceeds physically available units.
7. Investigate discrepancies before finance/month-end close.

## Month-end handoff to Finance

Before Finance closes the period, Inventory should confirm:

- major stock discrepancies are resolved or documented,
- returned stock has been inspected,
- damaged/quarantine stock is correctly held,
- purchase receipts are complete,
- no known batch-cost issue remains unexplained.

Do not use month-end close to “lock in” known bad inventory data.
