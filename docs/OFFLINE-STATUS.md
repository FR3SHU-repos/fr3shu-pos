# Offline feature status

Verified 2026-09-19 from the frontend, service worker, Go API, OpenAPI
contract, and offline tests.

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
- Offline cash-sale queue, automatic/manual retry, status display, local
  receipt view, export backup, repair of blocked lines/customer details, and
  local cancellation.
- Go `POST /api/v1/pos/sync/sales` endpoint with OpenAPI documentation.
- Server-side authenticated/idempotent processing path and per-operation sync
  outcomes.
- Tests covering offline products, held carts, sales, sync, session summary,
  API client behavior, and related POS calculations.

## Pending before calling offline POS production-ready

These are gaps between the current implementation and the offline proposal’s
first-release acceptance criteria:

1. Offline readiness/enrollment: enrolled terminal/register binding, bounded
   offline authorization grant, expiry, revocation handling, and local unlock
   after browser restart.
2. Outbox retry refinement: exponential backoff/jitter and server
   `Retry-After` handling still need to replace the current fixed retry delay.
3. Historical pricing and lot correctness: cache price/tax/lot snapshots and a
   versioned stale-price policy; current aggregate product caching cannot safely
   promise lot allocation while offline.
4. Inventory reconciliation: retain local deductions until a server snapshot or
   cursor includes the accepted sale, avoiding double deduction or temporary
   stock restoration.
5. Local cash semantics: persist tendered cash and change as first-class sale
   data and validate insufficient/invalid cash before local commit.
6. Recovery hardening: persistent-storage/quota checks, protected pending data
   across logout/account switching, schema migration failure handling, and
   validated import/recovery of exported records.
7. Service-worker/PWA hardening: production deep-link/reload verification,
   complete shell asset precaching, safe upgrades, and proof that migrations
   never delete pending financial records.
8. Full failure matrix: lost response after server commit, concurrent tabs,
   duplicate/altered operation IDs, shift closure, revoked user/device,
   archived products, stale prices, insufficient stock, and restored backups.
9. Pilot gates: supported browser/device matrix, receipt-printing tests,
    storage-denial/eviction tests, five-sale acceptance run, and a feature flag
    preventing unprepared terminals from accepting offline sales.

## Explicitly online-only for the first release

UPI/card/split payments, product and price edits, receiving/adjustments,
returns/voids, reward redemption, new login/password recovery, and automatic
message delivery remain online-only. Multi-terminal shared-stock guarantees,
customer identity linking, and reward confirmation require later policy and
server work.

## Source documents

- [Offline POS proposal](./OFFLINE-POS-PROPOSAL.md)
- [Current backend API contract](../../go-api-backend/docs/api-current.md)
- [OpenAPI contract](../../go-api-backend/openapi/openapi.yaml)
