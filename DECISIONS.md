# Decisions & Trade-offs

Dates are absolute. This build was done on 2026-09-04.

> **⚠️ Superseded by the Go cutover (2026-09).** D4 (embedded `fr3sh_pos`
> Mongoose database, `npm run seed`), D6 (`mongoose.models` model typing) and the
> `pos_token`/bcrypt auth assumptions no longer hold. This app now has no
> database and no local JWT; `go-api-backend` owns the POS runtime and Supabase
> Auth owns identity. POS business data lives in a dedicated `fr3sh_pos`
> **database on the Go backend's cluster** (see
> `go-api-backend/docs/pos-architecture.md`), not an embedded one here. The
> scope/tradeoff reasoning below is kept for history.

## Scope

**D1 — Thin vertical slice only.** The full brief is ~a month of work (≈20 models, ~35
pages, offline PWA sync, reporting, admin verification, full test suite). On the user's
instruction this build delivers ONE working path end to end: auth → minimal multi-tenancy
→ products & inventory → open register → `/pos` sale (atomic sale + payment + stock +
movement transaction, idempotent) → sale history → close register. Everything else is
deferred (below), documented, and **not** stubbed as fake screens.

**D2 — Location & name.** Built at `fr3shu-pos-webapp/` at the repo root (sibling of
`farmers-republic`, `fr3sh-warehouse-webapp`, `go-api-backend`), per the user's folder-name
instruction, rather than the brief's `cross-platform-assets/organic-pos/`.

**D3 — Starter source.** The brief references `Pasted markdown(1).md`, which does not exist
in the workspace. `farmers-republic/starter.md` is the canonical starter and was followed;
`fr3sh-warehouse-webapp` was used as the living reference for env/DB conventions.

## Data & infrastructure

**D4 — Database.** Shared Atlas cluster, isolated database `fr3sh_pos` (user's choice).
`.env.example` ships placeholders only; `.env.local` is git-ignored. The Atlas user is
managed and **cannot `dropDatabase`**, so `npm run seed` clears this app's collections with
`deleteMany({})` instead of dropping. Transactions require a replica set — Atlas provides
one; a standalone local `mongod` would fail the sale path.

**D5 — Money & quantity.** Integer paise everywhere; integer base units (`g`/`ml`/`count`)
for inventory with the sale unit stored separately (`shared/lib/money.ts`,
`shared/lib/units.ts`). Tax is basis points, applied on the post-discount amount.

**D6 — Model typing.** Models use `new Schema<IX>(...)` with an explicit
`const XModel: Model<IX> = mongoose.models.X || mongoose.model<IX>(...)` annotation (the
`farmers-republic` pattern). Without the annotation, `.lean()` return types collapse to
`any[] | any`. All ID reference fields are `String`, never `ObjectId`.

**D7 — One balance row per (location, product, lot)**, unique-indexed, is the atomic
decrement target. A single sale line must be satisfiable from **one** lot — no
split-across-lots. If no single lot has enough stock the sale fails with `409`. Deferred:
splitting a line across lots.

## Behaviour

**D8 — Idempotency.** `Sale.idempotencyKey` is unique. `createSale` does a fast-path
lookup; a lost `E11000` race re-reads and returns the winner. Verified end to end: a retry
returns the same `_id` with `reused: true` and does **not** decrement stock again.

**D9 — Server-authoritative totals.** Line prices come from `ProductPrice` (or the product
`basePricePaise` fallback) + the product tax rate. Any client-sent amount is ignored.
`payments` must sum exactly to the server total.

**D10 — FEFO with override.** Lots are auto-picked earliest-expiry-first. `Manager`,
`Owner` and `Admin` may pass an explicit `lotId` **with a reason**; other roles cannot.

**D11 — Certification: model now, enforcement later.** The `Certification` model and
snapshotting (onto lots at receipt, onto sale items at sale time) are implemented. The
admin verification queue, expiry reminders, and hard blocking of unverified products at
sale time are **deferred**. Today a cashier can sell a product whose `organicStatus` is not
`Verified`; the receipt correctly records it as unverified.

**D12 — Payments are recording only.** No gateway. `method` ∈ `cash | upi | card`,
optional operator-typed `upiRef`, never verified against a PSP.

**D13 — Register close threshold.** `POS_CASH_VARIANCE_NOTE_THRESHOLD_PAISE` (default
20000 = ₹200). A note is required above it.

## Tooling

**D14 — ESLint.** `eslint-config-next@16` ships a flat-config array consumed directly
(no `FlatCompat` — it hits a circular-JSON bug on ESLint 9.39). The new
`react-hooks/set-state-in-effect` rule (error by default in Next 16) is downgraded to
**warn** in `eslint.config.mjs`: the client pages legitimately fetch-on-mount through the
typed API client and `setState` with the result — the pattern React's own docs endorse
when there is no framework loader. `npm run lint` passes with 0 errors.

**D15 — Tests.** Vitest unit tests cover the pure functions that carry the money and
day-close correctness (`money`, `units`/FEFO, `pricing`, `registers`) — 16 tests. The
transactional guarantees (idempotency, single atomic decrement, oversell block, payment
reconciliation, RBAC, tenant isolation) were verified against the live Atlas database via
the running API (see the completion report); they are **not** yet automated integration
tests. Deferred: Vitest+mongodb-memory-server integration tests and Playwright e2e.

**D16 — i18n.** A tiny framework-free dictionary (`shared/lib/i18n.ts`) with `en` + `te`
covers the POS-critical labels; the `/pos` screen has a language switch. A full i18n
framework and route-based locales are deferred.

**D17 — PWA.** `manifest.webmanifest` + an SVG icon make it installable. No service
worker, no Dexie, no offline queue in this slice — that is the next slice and the
`sync/batch` API boundary is intentionally left open.

## Deferred (not built, not faked)

Offline PWA + Dexie + `POST /sync/batch` + reconciliation exceptions; reporting endpoints +
CSV export; admin `/admin/*` (sellers, certifications queue, audit-log viewer, platform
reports); returns & corrections (`POST /sales/:id/returns`); certification expiry reminders
& sale-time blocking; Upstash rate limiting (login guard is a documented no-op fallback);
team & settings pages; scheduled/future price changes; transfers & wastage UI;
`forgot-password` flow.
