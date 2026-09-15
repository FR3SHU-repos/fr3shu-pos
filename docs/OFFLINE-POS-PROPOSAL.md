# KOMOLA offline POS — refined proposal

Date: 2026-09-13. Status: proposed, not an implementation claim.

## Objective and first release

An enrolled seller terminal should complete eligible cash sales without a network request, retain them across browser restarts, and synchronize their financial and inventory effects once connectivity returns. The seller manually enters cash received; the app calculates change.

The first release supports one enrolled device per register, one previously opened shift, cached eligible products, customer name/phone snapshots, cash payments, local receipts, restart recovery, and reliable upload. Independent terminals sharing stock, offline product edits, returns, rewards, and messaging follow later.

“Offline-ready” is earned after the app shell, catalogue, register context, storage checks, and offline authorization are prepared successfully. A new device without this preparation requires internet.

## What exists today

Evidence is from the current source, rather than the historical API.md and POS-PROJECT-CONTEXT.md sections.

| Area | Existing implementation | Required extension |
| --- | --- | --- |
| Product cache | shared/lib/offline/products.ts stores scoped catalogue snapshots in IndexedDB; OfflineCatalogue.tsx provides in-tab browsing | Repository storage, readiness verification, safe versioned snapshots, offline boot |
| Checkout client | shared/lib/api/sales.ts first fetches registers, then posts a sale | Persist register/shift context and immutable sale locally before any request |
| Cash entry | POS page accepts tendered cash but sends the sale total as cash payment; change is held in component state | Persist cash received, amount applied, and change; validate insufficient/invalid input |
| Sale idempotency | Go checkout service locks by organization/key and compares request hashes; billing.sales has an organization/key uniqueness constraint | Durable client operation IDs, offline request contract, retry and concurrent-upload tests |
| Pricing | Go checkout reads active current prices and tax-inclusive rules | Historical price/tax snapshots and bounded offline pricing policy |
| Inventory | inventory.movements and inventory.balances already exist, with lot allocation in checkout | Reconciliation of local deductions and server allocation, without duplicate movements |
| Register context | Registers reference terminals and open shifts; checkout requires an open shift | Enrolled-device binding, original shift attribution, late-upload handling |
| Customer/rewards | Checkout resolves customer records and may award rewards | Preserve entered customer snapshot; defer identity verification and reward confirmation |
| Receipts | Go generates a sequential receipt number during checkout | Stable device receipt identity and immutable locally printable snapshot |

Do not rebuild inventory as a new event-sourcing system, replace PostgreSQL primary keys everywhere, or add a generic replication service before the first vertical slice works.

## Offline operation boundary

| Operation | First release behavior |
| --- | --- |
| Product browse/search/scan | Read prepared local catalogue; label last synchronization time |
| Cart and totals | Local; persist draft for recovery |
| Cash sale | Atomic local commit, then display “Saved on this device · waiting to sync” |
| Receipt generation/reprint | Read immutable local receipt, including entered cash and change |
| Customer entry | Keep required name/phone and consent snapshot; no automatic identity claim |
| Inventory | Deduct pending sales from local available stock; no offline receiving/adjustment UI |
| Google/new login/password reset | Online only |
| Restart offline | Reopen cached shell and unlock an enrolled, still-authorized terminal |
| Product/price edits | Online only |
| UPI/card/split | Keep existing online behavior; exclude from initial offline release |
| Returns/voids, reward redemption | Online only initially |
| Email delivery | No automatic send in this milestone; explicit delivery jobs later |
| Reports | Local pending-sale history and totals; cloud reports require connection |

Offline checkout is available only within these eligibility rules. Storage failure or an expired offline authorization must prevent a false success message.

## Storage and application boundary

Keep IndexedDB for the browser. Introduce repositories under shared/lib/offline rather than a new src tree. UI components call repositories/services and never open database transactions directly. A wrapper can be chosen during implementation; adding Dexie is optional, not a prerequisite.

Use one versioned database with stores for:

- catalogue records and snapshot metadata;
- terminal/register/shift context and offline authorization metadata;
- draft carts;
- immutable sales containing line, payment, customer, and receipt snapshots;
- pending inventory effects referencing the sale and line;
- durable outbox entries;
- synchronization receipts/cursors and diagnostics.

Nested immutable sale aggregates avoid ten separate local tables in the first milestone. Index sales/outbox by organization, location, terminal, actor, status, and creation time. Scope every operation explicitly; a mutable module-global current user alone is insufficient for financial writes and account-switch races.

Keep disposable catalogue caching separate from unsynced financial data. Migration failure, cache refresh, logout, or a service-worker update must never erase pending sales. Logout removes access, but retains protected pending records for the original authorized identity or an explicit recovery flow. A different seller must not see or upload them.

Request persistent storage and inspect quota, surface preparation failures, and provide a recoverable export/import format with schema version and original operation IDs. Import is validated and must not change tenant ownership. Protect exports containing customer data. Persistent storage reduces browser eviction risk but cannot prevent user deletion, device loss, or all browser failures. See [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

SQLite in a browser still uses browser-managed persistence and adds a runtime. Keep it as a future native-app option behind the same repositories; see [SQLite persistence documentation](https://sqlite.org/wasm/doc/tip/persistence.md).

## Identity, numbering, and timestamps

Generate a stable client operation UUID before the first local write. UUIDv4 already fits the project's use of crypto.randomUUID; UUIDv7/ULID is not required for correctness. Store server IDs returned during reconciliation alongside local IDs. PostgreSQL may continue generating internal primary keys.

Bind each installation to a server-enrolled terminal/register. A client-supplied terminal string is not authorization. Do not derive identifiers from hardware fingerprinting.

Use a collision-resistant local receipt reference such as terminal identifier plus a transactionally allocated sequence and installation generation. Never emulate the existing cloud-wide receipt sequence offline. Retain both the original device reference and any later server number; reprints must preserve the issued transaction snapshot. Tax-invoice numbering requirements need a separate validated decision before describing this as production-ready statutory invoicing.

Store occurredAt (device assertion), receivedAt/syncedAt (server), actor, terminal, original shift, schema version, catalogue version, and pricing policy version. Client clock values are audit evidence, not trusted authorization.

## Local cash checkout transaction

1. Validate offline readiness, actor/shift eligibility, item status, price/tax snapshot, quantities, and local available stock.
2. Validate money in integer paise. Require cash received >= amount due; amount applied equals amount due; change equals cash received minus amount due. Use existing unit conversion rules and shared calculation fixtures with Go.
3. In one IndexedDB transaction, write the immutable sale, receipt snapshot, local inventory effects, outbox record, receipt sequence, and completed-cart marker.
4. Wait for transaction completion before showing success or clearing the cart. An aborted transaction creates none of these records.
5. Start asynchronous upload. Printing is independent of upload and does not alter sale state. A print failure offers reprint, never another checkout.

The cashier must see sale state and cloud state separately. Use local sale states draft/completed, with append-only correction records later. Synchronization states are pending, uploading, retry_wait, synced, needs_review, and auth_required. “Needs review” never means the cash transaction disappeared.

## Go synchronization contract

Start with a bounded, sale-specific endpoint under /api/v1/pos/sync/sales. A generic /sync/push for arbitrary entities is unnecessary initially. Version the payload.

Each sale contains operationId, enrolled terminal/register/shift references, occurredAt, catalogue/policy version, immutable lines with SKU/unit/quantity/price/tax/discount snapshots, totals, cash received/applied/change, customer snapshot, and device receipt reference.

Go authenticates the current caller, validates historical offline authorization and tenant binding, recalculates snapshot arithmetic, and compares the canonical request hash. Client totals and client tenant IDs are never sufficient proof. Reuse checkout domain functions while adding an explicit offline ingestion path; posting old carts to the current online endpoint would reprice them and require a currently open shift.

Return an outcome per operation: accepted, already_accepted, needs_review, or rejected, with stable machine-readable reason codes and server mappings. Authentication failures pause upload. Malformed payloads must remain locally recoverable.

Process each sale atomically in PostgreSQL: accepted sale, lines, payment, inventory effects, operation receipt, and eligible downstream event. Never apply half a sale. If review is required, durably record a scoped review submission without treating it as a posted sale or applying partial inventory/rewards effects.

Use uniqueness scoped by organization and stable operation identity, plus request hashes. Repeating the same operation returns the same acknowledgement; changing its payload returns a conflict. A sync retry must not create another customer side effect, stock deduction, reward, or invoice delivery.

Do not accept separately uploaded sale inventory movements in this first contract: Go derives them from accepted sale lines so inventory cannot be deducted twice.

## Inventory, prices, and shift conflicts

| Situation | Proposed rule |
| --- | --- |
| New cloud catalogue price | Update future carts after refresh; preserve already completed sale price |
| Stale sale price | Accept only within a versioned offline pricing allowance; otherwise needs_review, with original receipt retained |
| Tax mismatch or invalid arithmetic | Needs review/rejection with reason; never silently change the amount paid |
| Insufficient server stock/lot mismatch | Needs review; never manufacture a lot allocation or silently discard the sale |
| Product archived after local sale | Preserve historical SKU snapshot; evaluate policy/time evidence rather than erase history |
| Product recalled or prohibited | Exclude from offline eligibility where possible; server review if policy changed while disconnected |
| Shift closed before upload | Attribute to original shift; accept as an auditable late adjustment only under policy, otherwise review |
| User/device revoked | Pause posting and require authorized reconciliation; preserve local record |
| Duplicate upload | Acknowledge prior outcome without repeating effects |

Local availability = server snapshot stock minus local sale deductions not represented in that snapshot. Upload acknowledgement alone is not enough to remove a deduction: retain it until a pull snapshot/cursor is known to include the accepted sale. Apply the new snapshot and deduction reconciliation atomically to avoid temporary inflated stock or double subtraction.

For tracked lots, preparation must include the lot data and eligibility policy needed by offline checkout, or exclude those SKUs from the first release. The current product cache contains aggregate stock and is insufficient to promise correct offline lot allocation.

One-device piloting reduces conflicts but does not eliminate cloud stock changes. Multiple disconnected devices cannot guarantee zero overselling of shared stock without preallocated stock budgets or another coordination rule. Add that policy before multi-terminal rollout.

## Upload, pull, and recovery

Use a persisted outbox with immutable payload, operation ID, attempts, next attempt time, last error, and an expiring upload lease. A single uploader per terminal claims work transactionally; expired leases recover after a crash. Server idempotency remains necessary even with local locking.

Trigger uploads at startup, reconnect, local commit, manual retry, and a modest interval while open. Use bounded requests and exponential backoff with jitter; respect Retry-After. Retry timeouts, connection failures, 429, and transient server failures. Pause 401/403 for authentication/authorization resolution. Do not endlessly retry permanent validation errors.

navigator.onLine is a hint; actual API outcomes determine reachability. Do not require continuous background execution after the browser closes. Persist first and resume on reopening.

Use complete scoped snapshots initially. Replace a snapshot only after all pages succeed; the backend must provide a consistent version or snapshot boundary if catalogue changes during pagination. Add cursor-based changes and deletion tombstones once correctness is proven. A timestamp alone is not a safe cursor: define commit ordering, pagination stability, retention expiry, and full-resync behavior.

Diagnostics and recovery are part of the first release: pending count/value, oldest pending record, last successful upload, review reasons, retry, reprint, and protected export. Keep synced operation receipts long enough to resolve lost acknowledgements and restored backups.

## Offline boot and authorization

Move PWA/service-worker work into the first milestone, before accepting real unsynced sales. Cache a versioned public shell and required JS/CSS/assets, with an offline route that can initialize repositories without server rendering or middleware authentication calls. Do not cache OAuth callbacks, bearer-token responses, or personalized HTML indiscriminately. Validate offline deep links and reloads in the production build.

Enroll online and issue a bounded server-verifiable offline grant containing actor, tenant, terminal, register/shift eligibility, capabilities, and expiry. Proposed pilot default: one shift, at most 12 hours since preparation; this is a policy choice, not an existing capability. Expiry blocks new offline sales while preserving history and recovery.

Offline restart requires a deliberate local unlock/protected-session design; a stored Supabase session or profile alone does not establish current permission. Revocation cannot be checked while disconnected, and browser JavaScript cannot make a terminal tamper-proof. Local PIN/unlock and key handling therefore need resolution before the restart milestone ships, rather than being deferred indefinitely. Never store a raw PIN or claim encryption protects data if its key is stored unprotected beside it.

New cloud login remains online. Before uploads, refresh cloud authentication and validate the enrolling identity/permissions. Service-worker upgrades and IndexedDB migrations must preserve unsynced operations and support old queued payload versions.

## Delivery sequence and release gates

| Stage | Deliverable | Gate |
| --- | --- | --- |
| A: contracts | Offline eligibility, cash fields, price/lot/shift policies, operation schema, identity/recovery design | Document reviewed against existing Go domain logic; no production offline write enablement |
| B: durable foundation | IndexedDB repositories/migrations, enrolled context, local unlock, cached app shell, diagnostics/export | Reopen offline and recover scoped test data after crash/update |
| C: cash vertical slice | Atomic checkout, inventory overlay, local receipt/history, sale sync endpoint and leased outbox | Five-sales milestone and failure tests below pass |
| D: controlled pilot | One device/register, feature flag, supported browser/device matrix | Real-device storage, printing, recovery, and late-shift reconciliation verified |
| E: expansion | Incremental pull, multiple-terminal stock policy, returns/corrections | No regression in financial idempotency or inventory accounting |
| F: integrations | Customer identity resolution, rewards, explicit message delivery queue | Verified identity and server-confirmed effects; consent and duplicate-delivery rules tested |

Customer phone/name matching must not automatically link a verified buyer identity or grant access to rewards. First release stores customer evidence only. Rewards remain non-spendable until server validation, and message delivery requires its own idempotent job after an accepted sale. Do not automatically invite or message customers as part of sync.

## Acceptance tests

The minimum demonstration: prepare online; disconnect; create five cash sales with manually entered cash, including one requiring change; produce/reprint receipts; close the browser; reopen offline and unlock; confirm all five sales and local deductions; reconnect; verify exactly five canonical PostgreSQL sales with one set of financial/inventory effects and unchanged receipt amounts.

Required companion tests:

- Abort local transaction or exhaust quota: no success, no partial sale, cart recoverable.
- Double-click checkout or use two tabs: one completed cart/receipt and one outbox operation.
- Server commits but response is lost; crash before acknowledgement: retry produces no duplicate effects.
- Retry same ID with altered data: deterministic conflict, original preserved.
- Close during upload: persisted lease recovers and pending work resumes.
- Pull before/after upload acknowledgement: availability never double-deducts or briefly restores sold stock.
- Price change, archived SKU, stale lot and insufficient stock: stated review policy, no silent repricing.
- Shift closes remotely; terminal/user revoked; authorization expires: correct pause/review, recoverable records.
- Sign out and switch seller/location: no cross-tenant reads or uploads; original records retained.
- Failed catalogue refresh: previous complete snapshot remains usable.
- Service-worker upgrade, migration failure and restored export: no lost operations or duplicate posting.
- Actual supported devices: offline restart/deep links, receipt printing, storage denial, browser eviction/recovery messaging.

Performance should be measured on the pilot devices: proposed target is p95 local search under 100 ms for a 10,000-SKU catalogue and local checkout commit under 500 ms, excluding printing. These are targets to test, not measured results.

This proposal authorizes no schema migration or billing implementation by itself. It is the refinement for the next implementation decision.
