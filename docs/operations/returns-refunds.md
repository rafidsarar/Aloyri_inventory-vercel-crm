# Returns & Refunds SOP

## Non-negotiable separation

Aloyri treats these as different events:

1. **Customer requests a return/refund review**
2. **Staff approves or rejects the request**
3. **Product physically returns**
4. **Inventory inspects returned stock**
5. **Finance decides customer settlement**
6. **Refund/credit/exchange is actually processed**

Never collapse those steps into one action.

## Website return request

Customer requirements:

- Website order number
- Same Bangladesh mobile number used at checkout
- Affected order lines and quantities
- Reason
- Product condition
- Preferred outcome
- Optional explanation

Eligible public requests are limited to Website orders in an appropriate delivered/returned state.

The customer preference is **not** the settlement decision.

## CRM request queue

Website return-request states:

- **Requested** — submitted by customer.
- **Reviewing** — staff is actively reviewing.
- **Approved** — request can proceed to the next return step.
- **Rejected** — request will not proceed.
- **Resolved** — request-review work is complete.

Staff should add a concise internal review note when the outcome is not self-explanatory.

### Approval does not:

- mark the order Returned,
- create a refund liability,
- issue money,
- create store credit,
- restock stock,
- classify the physical product,
- alter batch cost.

## Physical return receipt

Only after the parcel/product is actually received:

1. Verify the order and returned quantities.
2. Move the order through the supported Returned workflow when appropriate.
3. Keep the returned product separate from sellable inventory until inspection.

## Inventory inspection

Authorized: Owner, Admin, Inventory manager.

Inspect as one of:

### Sellable

Use only when the product is physically safe and eligible to return to sellable inventory under Aloyri policy.

### Quarantine

Use when the product needs further inspection or should not be available for sale yet.

### Damaged

Use when the product is damaged/not fit for sellable stock.

The inspection workflow is responsible for the supported inventory-hold behavior. Do not create manual compensating stock entries unless the supported workflow genuinely cannot represent the event.

## Finance settlement

Authorized finance workflow: Owner/Admin/Finance manager.

Settlement choices may include:

- Refund
- No refund
- Store credit
- Exchange

The settlement outcome is independent of inventory condition.

Examples:

- A product can be damaged and still qualify for a customer refund.
- A product can be physically returned but not qualify for a refund.
- A refund can be due even when the product is not restocked.
- Store credit must not be treated as cash paid out.

## Refund processing

Before recording a customer refund:

1. Confirm the return settlement decision.
2. Confirm the approved refund amount.
3. Confirm the refund method/account.
4. Confirm the refund is not already recorded.
5. Record the customer refund in CRM.
6. Reconcile the cash/bank/mobile-money movement with Finance.

Do not create a negative sale, fake expense, or stock adjustment as a substitute for the customer-refund workflow.

## No-refund return

When the product is returned but no refund is due:

- complete inventory inspection normally,
- record the Finance settlement as No refund,
- do not create a customer cash outflow,
- retain the decision trail.

## Store credit / exchange

- Record the settlement as Store credit or Exchange.
- Apply credit only through the supported credit-use/replacement-order workflow.
- Do not mark store credit as cash collected or refunded.
- Ensure the replacement order remains a valid order with its own stock allocation and status.

## Damaged-stock accounting

A returned product classified as Damaged should remain separated from sellable stock through the Holds & Returns process.

Finance should recognize the economic effect through the system's return/damaged-stock reporting rather than creating an arbitrary customer refund amount from stock cost.

## End-of-case checklist

A return case is complete only when all applicable items are true:

- request review completed,
- physical return status is accurate,
- inventory inspection completed,
- returned item is either sellable or correctly held/quarantined/damaged,
- finance settlement recorded,
- actual refund/credit/exchange processed if due,
- order/customer financial balance is correct,
- no duplicate refund exists,
- CRM history explains the outcome.
