# POS edge-case analysis

Status: analysis reference

Reviewed: 2026-10-22

Scope: seller POS checkout, offline storage, synchronization, inventory,
receipts, buyer attribution, registers, payments, and supporting browser/PWA
behavior.

This document records the edge cases identified during the POS review. It is a
static code and workflow analysis, not a replacement for production load,
security, or end-to-end testing.

## Current baseline

The POS test suite currently passes:

- 31 test files
- 116 tests

Existing protections include:

- Offline checkout is cash-only.
- Customer mobile number is required and validated.
- Offline sale records use local operation IDs for idempotency.
- Server-side sale creation uses idempotency checks.
- Offline sales are leased before upload to reduce duplicate uploads across tabs.
- Product, price, tax, unit, and catalogue changes can be routed to manual review.
- Server stock shortfalls are recorded as adjustment records.
- Offline product and stock creation is disabled in the current seller UI.
- Failed syncs remain visible in the offline panel instead of being silently deleted.

The tests do not yet cover all browser, multi-tab, device-loss, clock, or real
network-interruption scenarios described below.

## P0 risks

### Buyer identity can change before offline synchronization

Pending offline receipts can be edited through
`shared/lib/offline/sales-sync-state.ts`. The edit path can change both the
customer phone number and `buyerCode`.

Risk:

1. A seller records a sale for Buyer A.
2. The seller edits the pending receipt before synchronization.
3. The seller enters Buyer B's code.
4. The server may attach the sale and rewards to Buyer B.

Required policy:

- Freeze the verified buyer identity at checkout.
- Allow phone correction only for guest receipts.
- Do not allow `buyerCode` changes after checkout.
- If a verified buyer must be changed, require manager approval and retain the
  original buyer assignment.
- Rewards must always use the immutable buyer assignment captured at checkout.
- A phone edit after synchronization must update receipt contact information
  only; it must never transfer already-assigned rewards.

### Offline payload trust and authorization

`go-api-backend/internal/modules/checkout/service.go` currently supports older
clients where an offline grant is optional, and offline synchronization enables
inventory debt handling.

Risk:

- A modified browser can fabricate or alter offline sale payloads.
- A client can attempt to create sales without a valid current offline grant.
- A compromised device can create unusually large stock debt.

Required safeguards:

- Require a valid, non-expired, device-bound offline grant.
- Bind the grant to seller, organization, location, register, shift, and device.
- Sign the offline payload or use a server-issued authorization token.
- Enforce limits for offline duration, transaction amount, quantity, and total
  inventory debt.
- Record every offline override in an audit log.

### Local cancellation of cash transactions

The offline panel allows a pending local sale to be cancelled. The server does
not receive a record when this happens.

Risk: cash may have been collected while the local transaction is removed from
the synchronization queue.

Required safeguards:

- Never permanently delete the transaction.
- Use a `cancelled_pending_review` state.
- Require manager PIN or manager approval.
- Record seller, device, timestamp, reason, original receipt, customer, and
  item details.
- Include cancelled transactions in an audit report.

### Offline stock debt and overselling

The current design allows a seller to sell more than the server stock knows
about. The server allocates available stock and creates an adjustment for the
shortfall.

Example:

| Value | Quantity |
|---|---:|
| Server stock before sync | 10 |
| Offline requested quantity | 20 |
| Automatically allocated | 10 |
| Shortfall requiring review | 10 |

Additional cases require explicit policy:

- Multiple devices sell the same product while offline.
- Multiple tabs use the same register.
- The seller remains offline for several days.
- A shortfall is much larger than the available stock.
- The product is discontinued while offline.
- The lot expires before synchronization.
- The product unit changes from kg to piece.
- Stock is manually adjusted by another operator before sync.

Required safeguards:

- Allocate only the stock available at the server.
- Create a separate adjustment for the remainder.
- Require manager approval for the shortfall.
- Configure a maximum debt threshold.
- Quarantine unusually large or repeated shortages.
- Display server-before, requested, allocated, shortfall, seller, register, and
  receipt details.

### Product and stock mutation duplication

The legacy offline mutation queue in
`shared/lib/offline/mutations.ts` still contains product-create and stock-receipt
sync paths, even though the current UI disables those actions offline.

Potential failures:

- Two tabs create the same product.
- The server creates a product but the response is lost.
- A stock receipt is retried after a successful server commit.
- Product creation succeeds while its stock receipt fails.
- A local product-to-server ID mapping is not persisted.

Required safeguards:

- Remove the legacy queue if offline creation is permanently unsupported, or
  add server idempotency keys to product and stock receipt endpoints.
- Use leases for mutation uploads.
- Persist local-to-server mappings atomically.
- Show unresolved mutations separately from offline sales.

## P1 consistency risks

### Lease expiry and duplicate upload attempts

Offline sales use a short local upload lease. A slow request can outlive the
lease and be picked up by another tab or retry loop.

Server sale idempotency should prevent duplicate final sales, but the UI must
reconcile `uploading`, `retry`, and `already_accepted` states by operation ID.

### Successful commit with lost response

The server may commit a sale while the response is lost. The browser then
retries the same operation.

Required invariant: the same operation ID must always return the same server
sale, and a changed payload using that operation ID must be rejected as a
conflict.

### Stale product, price, tax, or unit data

Before synchronization, a product may be:

- Deactivated or deleted.
- Repriced.
- Assigned a different tax rule.
- Changed to another sale unit.
- Moved to another location.
- Missing an active price list.

The current flow can route these cases to manual review. The review screen
should show the original and current values so the seller can make an informed
correction.

### Lot and expiry differences

Offline lot evidence can become stale before sync. The server may have:

- Expired the lot.
- Sold the lot from another device.
- Changed the available quantity.
- Marked the lot unavailable.
- Created a newer FEFO lot.

The server must remain authoritative for allocation. If the actual lot differs
from the offline evidence, the receipt should preserve both the original
evidence and final server allocation for auditability.

### Register and shift state changes

A cached register or shift can become invalid when:

- Another operator closes the shift.
- The register is reassigned.
- The shift expires.
- The seller is removed from the organization.
- Location access is revoked.
- The offline grant is revoked.

The server should return a distinct state such as `shift_closed`,
`register_unavailable`, `operator_mismatch`, `location_mismatch`, or
`auth_required`. The sale must remain locally preserved while the conflict is
resolved.

### Customer phone and buyer-code mismatch

A seller can enter a valid buyer code and a different phone number. The buyer
code should be authoritative for a verified buyer, and the UI should warn the
seller before checkout that the verified buyer's phone will be used.

### Guest receipt claiming

Claiming a guest receipt later can race with another claim or be affected by a
mistyped phone number.

Test and enforce:

- Verified buyer authentication.
- One-time receipt claim.
- Database-level uniqueness for the claim.
- Claim rejection after void/refund where appropriate.
- Concurrent claim attempts.
- Phone correction before and after claiming.

### Refunds and voids during offline periods

Offline checkout supports cash, but offline refunds and voids are not an
equivalent workflow.

Recommended policy:

- Disable offline returns initially.
- Allow returns only after the sale exists on the server.
- Require manager approval for voids and cash refunds.
- Make return and void operations idempotent.
- Prevent a sale from being refunded twice after sync retries.

## P1 storage, privacy, and device risks

### IndexedDB loss or quota exhaustion

Offline records can be lost or become inaccessible when:

- Browser data is cleared.
- Private browsing is used.
- Storage is evicted.
- Device storage is full.
- IndexedDB is blocked.
- The PWA is reinstalled.
- The device crashes during a write.

The app checks storage headroom and supports backup export. Sellers should be
warned to export backups before clearing browser data or changing devices.

### Backup import

Backup files may be duplicated, tampered with, imported into the wrong scope,
or created by an older schema version.

Import validation should include:

- Seller, organization, and location scope.
- Schema version.
- File size and record count.
- Operation IDs and duplicate detection.
- Customer phone format.
- Monetary totals.
- Product and lot references.
- Original timestamps.

### Local personal-data exposure

Offline storage contains names, phone numbers, buyer codes, and receipt data.
Risks include shared terminals, stolen devices, browser profile access, and
unprotected exported backups.

Recommended safeguards:

- Lock offline mode after inactivity.
- Require re-authentication to view or export data.
- Mask phone numbers in list views.
- Encrypt sensitive local data where practical.
- Purge synced records according to the retention policy.
- Audit backup exports.

### Multiple tabs and devices

Test the following combinations:

- Two POS tabs selling the same product.
- Two sellers using the same register.
- One seller logged in on two devices.
- One device offline while another changes stock online.
- Logout in one tab while another tab remains open.
- Switching organization or location while offline data exists.

The server must remain authoritative for stock, register ownership, and buyer
identity. The client should show a conflict instead of silently trusting stale
state.

## P1 network, payment, and time risks

### Flaky connectivity

`navigator.onLine` is only a browser hint. The device may appear online while
DNS, authentication, Render, Supabase, or the API is unavailable.

Test:

- Network loss before save.
- Network loss after server commit.
- API timeout.
- DNS failure.
- 401 or 403 during sync.
- 404 caused by frontend/backend version skew.
- Repeated online/offline transitions.
- Aborted requests during navigation.

Every failure must leave a visible, retryable local state.

### Cash and monetary boundaries

Test:

- Exact cash amount.
- Insufficient cash.
- Very large values.
- More than two decimal places.
- Negative, empty, or malformed values.
- Split payment rounding.
- Incorrect UPI reference.
- UPI payment submitted without external confirmation.

Add maximum transaction limits and safe-integer checks before converting user
input to paise.

### Quantity and unit boundaries

Test:

- Zero and negative quantities.
- Very small decimal quantities.
- More than six decimal places.
- Fractional pieces, bunches, or packs.
- Very large quantities.
- kg/gram and litre/millilitre conversion boundaries.
- Unit changes while offline.

### Authentication and session expiry

A seller may work offline after the Supabase session expires, the account is
suspended, membership is removed, or the offline grant is revoked.

The sale must remain preserved and transition to `auth_required` or
`needs_review`; it must never disappear.

### Clock and timestamp differences

The local device clock affects receipt times, grant expiry, retry timing, lot
expiry, and analytics business dates.

The server should store both device event time and server receipt time, reject
unreasonable timestamps, and show clock-related records for review.

## P2 UI and lifecycle risks

Test interruptions during:

- Buyer lookup.
- Payment submission.
- IndexedDB commit.
- Receipt rendering.
- Printing or PDF generation.
- Browser reload.
- Tab close.
- PWA update.

Held carts also need revalidation because prices, taxes, units, products, and
stock may have changed while the cart was stored.

Receipt printing can fail because of popup blockers, unavailable printers,
missing fonts, or image loading errors. The digital receipt must remain
available independently of printing.

## Category and location constants

The local category list reduces database traffic, but it introduces a version
consistency risk. The static list must stay aligned with backend validation and
database identifiers.

Whenever categories change:

1. Update `shared/lib/catalogue-categories.ts`.
2. Update backend seed/reference data if needed.
3. Verify existing product category references.
4. Run product creation and catalogue listing tests.
5. Record the change in the release notes.

## Recommended implementation order

### P0

1. Freeze verified buyer identity after checkout.
2. Require signed, device-bound offline authorization.
3. Add manager approval and audit records for local cancellation.
4. Remove or harden the legacy offline product/stock mutation queue.
5. Add offline stock-debt and transaction-value limits.
6. Protect local customer data and backup exports.

### P1

1. Add multi-tab and multi-device synchronization tests.
2. Improve stock and price conflict explanations.
3. Add clock and timestamp validation.
4. Add explicit register and shift conflict states.
5. Add receipt-claim race tests.
6. Add lost-response and API-version-skew tests.

### P2

1. Test storage eviction, private browsing, and device replacement.
2. Test PWA/database migrations across old and new versions.
3. Add receipt print/share failure tests.
4. Add category/version consistency checks.
5. Run performance tests with hundreds of pending offline sales.

## Minimum acceptance test matrix

Before treating offline POS as production-ready, test at least:

1. Offline cash sale with valid guest phone.
2. Offline sale with verified buyer code.
3. Missing, malformed, and corrected phone number.
4. Attempt to change verified buyer after checkout.
5. Duplicate checkout click.
6. Browser reload after local save.
7. Network loss after server commit.
8. Two tabs syncing the same sale.
9. Two devices overselling the same stock.
10. Price, tax, unit, and product deactivation conflicts.
11. Expired or depleted lot during sync.
12. Stock shortfall and manager adjustment approval.
13. Expired offline authorization.
14. Closed register or shift during sync.
15. Session expiry during sync.
16. IndexedDB quota failure.
17. Browser data deletion and backup restoration.
18. Duplicate or tampered backup import.
19. Receipt claim race.
20. Refund or void after offline synchronization.
21. Device clock ahead and behind server time.
22. Very large monetary and quantity values.
23. PWA update while pending sales exist.
24. Print, PDF, and WhatsApp share failure.

The highest-priority unresolved issue is buyer reassignment: editing a pending
offline receipt must never transfer rewards from one buyer account to another.
