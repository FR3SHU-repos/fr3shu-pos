# Offline feature status

Verified 2026-10-20 from the frontend, service worker, Go API, OpenAPI
contract, and offline tests.

## Current offline policy (2026-10-20)

The seller workflow is not gated by an online “prepare offline mode” step. If
connectivity drops, the POS continues recording cash sales from the saved
catalogue. Products and stock receipts can also be created while disconnected;
they are stored in a scoped local mutation queue and uploaded after reconnect.

Offline sales may exceed the last locally known stock. The server consumes any
available lots and records the remaining quantity in
`pos.offline_stock_adjustments` with `pending_review` status. Sellers can see
these records from the Stock page after sync. The previous readiness/grant
fields remain for backward-compatible older clients, but are optional for new
local transactions.

## Phase implementation history

This table records the earlier phased rollout. The current policy above is the
authoritative behavior for new offline work; the old readiness/pilot gate is
retained only for compatibility and operational reference.

| Phase | Delivered outcome |
| --- | --- |
| 1. Audit and readiness | Scoped IndexedDB storage, persistent-storage/quota checks, open-register preparation, server-issued 12-hour offline grants, grant hashing/revocation, and a readiness gate for new offline sales. |
| 2. Fast local checkout | Complete catalogue snapshots, deterministic snapshot and pricing-policy metadata, local barcode/SKU lookup, immutable local cash-sale records, local receipt/change data, and atomic sale/outbox commits. |
| 3. Reconciliation | Server validation of frozen catalogue evidence, stable `needs_review` reasons, local stock deductions, post-ack inventory coverage, and reviewable inventory/lot conflicts. |
| 4. Outage and recovery | Idempotent lost-response recovery, `already_accepted` and `operation_conflict` outcomes, closed-shift handling, bounded sync batches, leases, retry scheduling, backup export/import, and IndexedDB upgrade/quota recovery. |
| 5. Mobile-data efficiency | Fifteen-minute catalogue freshness, forced refresh boundaries, idle sync short-circuiting, bounded uploads, and session-only network diagnostics. |
| 6. Pilot rollout | Explicit build-time pilot flag, organization/location/register/terminal allowlists, server terminal identity in register reads, preparation/commit enforcement, and the pilot acceptance runbook. |

The table records code delivered in the current implementation. It does not
mean that the remaining production-readiness checks below have been completed
on real devices or production-like networks.

## Implemented now

- Versioned service-worker shell caching with an offline route and navigation
  fallback.
- IndexedDB-backed scoped product snapshots and offline catalogue browsing.
- Local held carts and offline-sale records with durable operation IDs.
- Atomic local cash checkout: sale, receipt/cash/change, outbox entry, and
  receipt sequence are committed in one IndexedDB transaction; operation-ID
  replays are locally idempotent.
- Durable outbox leasing: one uploader claims a bounded batch, and abandoned
  uploads become claimable again after lease expiry.
- Durable retry scheduling: exponential backoff with bounded jitter and
  server `Retry-After` support.
- Offline cash-sale queue, automatic/manual retry, status display, local
  receipt view, export backup, repair of blocked lines/customer details, and
  local cancellation.
- Go `POST /api/v1/pos/sync/sales` endpoint with OpenAPI documentation.
- Server-side authenticated/idempotent processing path and per-operation sync
  outcomes.
- Tests covering offline products, held carts, sales, sync, session summary,
  API client behavior, and related POS calculations.
- `komola-offline-pos-v1` IndexedDB schema version 3 stores sales, outbox,
  session context, metadata, and held carts; product snapshots use the separate
  `komola-offline-products-v1` database. Records are scoped by user,
  organization, and location.
- No local PIN is required. Offline access remains bound to the signed-in
  workspace scope and cached register/session context. Logout and account
  switching clear the active scope; the server remains the authority when
  queued records synchronize.
- Automatic sync runs on workspace mount, online transitions, local sale
  changes, and a 30-second interval. It first checks the scoped local outbox;
  an idle terminal makes no catalogue or sync request. When local work exists,
  it refreshes a stale catalogue before upload, claims at most 10 operations,
  and uses expiring leases plus bounded backoff/jitter.
- The seller shell exposes online/offline, server-unavailable, pending-sync,
  authentication-required, and service-worker-update states. It never caches
  personalized POS HTML or API/auth responses in the service worker.
- Legacy Phase 1 readiness remains implemented for older clients: a seller can
  prepare an open register online, save a complete product snapshot, request
  persistent browser storage, and receive a server-issued 12-hour offline
  grant. Current local checkout does not depend on this step.
- Older offline grants are still stored server-side as hashes and can be
  revoked by a manager. Grant-bearing legacy uploads remain supported, while
  new local sales do not require one. The IndexedDB database remains schema
  version 3 and retains the readiness store for compatibility.
- Phase 2 local checkout metadata is now implemented: each complete catalogue
  snapshot has a content version, effective time, and pricing-policy version;
  each locally completed sale copies those values into its immutable record and
  sync payload. Exact barcode/SKU lookup remains local after preparation.
- Phase 3 reconciliation safeguards are now implemented: the Go API validates
  the frozen snapshot metadata and compares each offline line's unit, price,
  and tax rule with the authoritative SKU before creating the sale. Missing or
  changed evidence returns a stable `needs_review` outcome, while inventory
  and lot conflicts are retained as reviewable local receipts.
- Accepted offline sales now remain in local stock deductions until a
  successful post-ack catalogue refresh records an inventory coverage marker.
  A server acknowledgement alone no longer restores local stock.
- Exact retries after a lost server response now resolve as `already_accepted`
  before offline-grant or shift revalidation; altered operation payloads are
  rejected as `operation_conflict`.
- Closed-shift and inventory failures remain reviewable instead of disappearing
  into a generic retry state.
- Scope-bound offline sales backups can be validated and imported additively;
  existing records are never overwritten and pending records are re-queued
  atomically.
- IndexedDB upgrade blocking and version changes in both offline stores, plus
  quota failures during sale commits, now produce actionable recovery messages.
- Phase 5 mobile-data safeguards are now implemented: catalogue snapshots are
  reused for 15 minutes, preparation/reconnect/manual refresh can force a new
  snapshot, and accepted-sale inventory coverage forces a post-sync refresh.
  The background worker does not download the catalogue when there is no local
  pending/reviewable work.
- Phase 5 pilot diagnostics are now local-only and session-scoped: successful
  catalogue refresh count and response bytes, sync count and latency, retry
  count, and sync upload bytes are available in browser session storage. They
  are intentionally not sent to a server yet.
- The previous phase-6 pilot gate is no longer used by local checkout. Rollout
  controls should be applied through deployment, support, and monitoring
  procedures rather than a checkout blocker.
- `docs/OFFLINE-PILOT-PLAYBOOK.md` documents deployment setup, the five-sale
  acceptance run, stop conditions, and the online-only payment boundaries.
- Offline catalogue responses now carry a location inventory cursor and active
  lot balances. Offline lines preserve that lot evidence, and the API returns
  stable review reasons for missing/invalid lot evidence or cursors.
- The service worker is now `komola-pos-shell-v4`: optional shell assets are
  cached independently, updates wait for user activation, failed static
  responses are not cached, and navigation falls back to a cached route before
  the offline page.
- Receipt printing has a shared browser capability wrapper with an automated
  test. Low-storage, printer, mobile-browser, and five-sale acceptance steps
  are documented in `docs/OFFLINE-DEVICE-TEST-MATRIX.md` and
  `docs/OFFLINE-OPERATIONS-RUNBOOK.md`.

## Pending before calling offline POS production-ready

These are gaps between the current implementation and the offline proposal’s
first-release acceptance criteria:

1. Manual verification remains: run the full failure matrix on supported
   devices, including browser eviction and service-worker upgrade behavior.
2. Pilot execution remains: complete Android, iPhone/PWA, desktop, printer,
   low-storage, and five-sale acceptance runs on real pilot hardware. The
   deterministic portions are automated and the procedures are documented,
   but this workspace cannot claim physical-device execution.

## Pending work summary

| Workstream | Remaining work | Release impact |
| --- | --- | --- |
| Security | Physical verification of account-switching, logout, and grant-expiry behavior | Required before treating a disconnected reopened device as fully authorized |
| Reconciliation | Physical verification of lot/cursor evidence under stock changes | Required before claiming complete multi-terminal stock and lot guarantees |
| Resilience | Physical service-worker upgrade/eviction checks and the full failure matrix | Required before broad rollout |
| Product scope | Keep UPI/card/split payments, refunds/voids, reward redemption, product edits, price changes, inventory corrections, and new authentication online-only; allow product creation and stock receipts offline | No blocker for the current cash-only pilot; blocker for expanding the remaining offline scope |
| Verification | Execute the Android/iPhone/desktop matrix, low-end-device performance, printing, storage denial/eviction, restart, reconnect, and five-sale reconciliation | Required before enabling the pilot outside test builds |
| Operations | Use the rollback/cache-busting, support, and incident procedures in the operations runbook and record pilot results | Required for controlled rollout and incident response |

## Target offline POS behavior

The supplied offline-POS references establish the product expectation: an
outage should be a controlled change of connectivity state, not a change in
the cashier's workflow. A terminal with a cached workspace and saved data
should continue scanning or searching products, building carts, calculating
the approved local price/tax rules, recording eligible payment, attributing
the sale to the signed-in operator, and producing a local receipt. When
connectivity returns, the terminal should upload automatically in order,
without manual re-entry, while clearly separating “saved on this device” from
“accepted by the server.”

This is the target behavior for KOMOLA, not a claim that the current build
already meets every point. KOMOLA's first release remains intentionally
cash-only offline. Product creation and stock receipts are also supported
offline through the local mutation queue. Product edits, price changes,
returns/voids, rewards redemption, and new authentication remain online-only
until their own correctness and authorization policies exist.

## Required implementation changes

The work should be delivered in these phases, with each phase verified before
offline sales are enabled more broadly.

### A. Prepare and authorize the terminal (legacy compatibility)

- Legacy support: explicit online preparation for a seller, register, open
  shift, saved catalogue, and bounded offline capability grant.
- Implemented: grant hashes are persisted server-side with expiry and manager
  revocation; raw grant tokens are returned only to the prepared browser and
  are never logged.
- Show readiness diagnostics when useful: last catalogue sync,
  register/shift, storage availability, pending records, and device scope.
- The seller shell may show preparation state for diagnostics, but current
  local checkout does not block on preparation, a grant, or a pilot flag.
- Persistent storage is requested on preparation and quota headroom is checked.
- No local PIN is required after a browser restart. The signed-in workspace,
  scoped offline records, prepared register/shift, device identity, and
  expiring server grant remain the authorization boundaries.

### B. Build the fast local checkout path

- Implemented: the prepared catalogue is searchable locally, including exact
  barcode and SKU lookup, so ordinary product entry does not depend on a round
  trip.
- Implemented: catalogue snapshots carry a deterministic content version,
  effective time, and `pos-price-tax-manual-discount-v1` policy version. Local
  sale lines already copy price, tax, unit, quantity, manual discount, and
  eligibility evidence; the sale now also carries the snapshot metadata. No
  automatic server promotion is claimed offline yet.
- Keep the cashier flow familiar during an outage: scan/search, cart, cash,
  change, customer details when available, receipt, and next sale.
- Persist employee/operator, terminal, register, shift, customer snapshot,
  payment, timestamp, and local receipt reference with the sale.
- Keep local search and local checkout within measured device targets. The
  current proposal target is p95 search under 100 ms and local commit under
  500 ms, excluding printing; these targets must be proven on supported
  low-end Android devices.

### C. Synchronize and reconcile safely

- Persist an immutable outbox payload before showing local success.
- Upload bounded batches in creation order with operation IDs, leases,
  idempotency, exponential backoff, jitter, and `Retry-After` handling.
- Continue automatically after reconnect or reopening the app; never require
  staff to type the sale again.
- Reconcile inventory using a versioned snapshot/cursor. Do not remove local
  stock deductions merely because the server acknowledged an upload.
- Return stable outcomes for accepted, already accepted, retry, conflict,
  authorization failure, and permanent rejection.
- Keep rejected or review-required sales and receipts recoverable. Never apply
  half a sale, duplicate inventory movement, duplicate reward, or duplicate
  customer side effect.

### D. Handle real-world outage and recovery cases

Test and provide an actionable state for:

- connection loss during checkout;
- browser crash or device restart after local commit;
- server commit followed by a lost response;
- duplicate checkout clicks and multiple tabs;
- expired/revoked authorization;
- closed shifts and changed registers;
- changed prices, taxes, promotions, archived products, and insufficient stock;
- storage denial, quota exhaustion, browser eviction, and service-worker update;
- account switching, logout, restored backup, and cross-location access.

The interface must always distinguish local completion, uploading, retrying,
blocked/review-required, and server-confirmed states. A printed local receipt
must remain available even if synchronization is delayed.

### E. Reduce mobile-data use

- Implemented: the background worker checks local sync state before any
  catalogue request and stays network-idle when there is no local work.
- Implemented: reuse a complete saved snapshot for 15 minutes; preparation,
  reconnect, manual refresh, and successful post-ack inventory coverage can
  explicitly force a refresh.
- Still pending: versioned delta/cursor sync and deletion tombstones after the
  first correct snapshot implementation.
- Keep sync payloads bounded, avoid repeated unchanged data, and use response
  compression where supported.
- Prefer local search and barcode lookup after preparation; use server search
  only for uncached data or an explicit refresh.
- Measure the remaining battery impact and validate the local session
  diagnostics on representative mobile networks. Exact transfer accounting
  depends on server `Content-Length` headers; absent headers are recorded as
  zero rather than estimated.

### F. Pilot before general rollout

- Historical pilot controls remain available for deployment operations, but
  they are no longer a customer-facing prerequisite for local checkout.
- Pilot one device per register with a known supported browser/device matrix.
- Run the five-sale acceptance flow from the offline proposal, including
  change, receipt reprint, browser restart, reconnect, and exact server-side
  reconciliation.
- Verify that offline sales, pending customer data, and exports follow the
  same retention, privacy, access, and deletion rules as online data.
- Record measured results and unresolved conflicts before increasing the
  offline authorization window, number of devices, or supported payment
  methods.

The supplied articles are useful as a user-experience north star, but they do
not override KOMOLA's server authority, privacy rules, or the explicit
cash-only first-release boundary. Claims such as offline gift cards,
promotions, employee management, real-time inventory, or arbitrary payments
must be implemented only after their local policy snapshots, conflict rules,
authorization, and reconciliation behavior are defined and tested.

## Explicitly online-only for the first release

UPI/card/split payments, product and price edits, returns/voids, reward
redemption, new login/password recovery, and automatic message delivery
remain online-only. Offline product creation and stock receipts are supported;
when an offline sale exceeds server stock, the resulting adjustment requires
manager review after synchronization. Multi-terminal shared-stock guarantees,
customer identity linking, and reward confirmation require later policy and
server work.

## Source documents

- [Offline POS proposal](./OFFLINE-POS-PROPOSAL.md)
- [Current backend API contract](../../go-api-backend/docs/api-current.md)
- [OpenAPI contract](../../go-api-backend/openapi/openapi.yaml)
