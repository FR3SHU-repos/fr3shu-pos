# KOMOLA POS frontend system reference

**Status:** implementation-derived reference, reviewed 15 October 2026
**Repository:** `komola-pos`
**Runtime:** Next.js 16 / React 19 / TypeScript
**Backend:** `go-api-backend` through the same-origin Next proxy
**Persistence:** browser IndexedDB for offline POS recovery; PostgreSQL is
owned by the Go API

This is the compact reference an engineer or AI agent should read before
changing the POS frontend. It describes the active implementation, not the
removed MongoDB server or the proposed offline/PWA work that has not yet been
verified on every production device.

## 1. System shape

```text
Browser
  ├─ Supabase Auth client/session cookies
  ├─ Supabase Storage upload for product images
  └─ typed clients in shared/lib/api
          │ same-origin /api/v1/*
          ▼
Next route handler: app/api/v1/[...path]/route.ts
  HTTP relay only; no database access
          │ HTTP / JSON, bearer/cookie/idempotency headers
          ▼
Go/Gin API: go-api-backend/cmd/api
          │ SQL transactions through pgxpool
          ▼
Supabase PostgreSQL
```

The POS repository has no application database, ORM, MongoDB connection, or
server-side business-data model. Supabase Auth is used for identity and
Supabase Storage is used for direct product-image uploads. Application data,
authorization, validation, transactions, stock, money, rewards, and tenant
scope belong to the Go API.

## 2. Next.js runtime boundary

### Browser API client

- `shared/lib/api/client.ts` is the single typed request boundary.
- With no public API alias configured, `request("<path>")` calls
  `/api/v1/<path>` through the same-origin proxy.
- `goRequest("<path>")` calls `/api/v1/pos/<path>` for POS operations in that
  same-origin mode.
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL`, and the historical
  catalogue alias can intentionally select a direct compatible Go origin for
  deployments that do not use the Next proxy.
- The client obtains the current Supabase access token in the browser and sends
  it as `Authorization: Bearer ...`; it also uses `credentials: include` for
  the session cookie.
- A `401` causes one Supabase session refresh and one retry when a new token is
  available.
- Signal-free GET requests are deduplicated while the same request is in
  flight. Mutations are never deduplicated by this client.
- Responses are normalized to `ApiResult<T>` with `success`, `message`,
  `data`, `status`, optional `code`, and parsed `Retry-After` information.

### Next proxy

`app/api/v1/[...path]/route.ts` accepts GET, POST, PATCH, PUT, and DELETE. It
URL-encodes each path segment, appends `/api/v1`, and delegates to
`shared/lib/api/go-proxy.ts`.

The proxy:

- resolves the upstream from `GO_API_BASE_URL` first, then compatible public
  aliases in non-development environments;
- pins development requests to `http://localhost:8080`;
- forwards cookies, authorization, `Idempotency-Key`, `If-Match`,
  `X-Organization-ID`, and `X-Location-ID`;
- uses `cache: "no-store"` and a 25-second upstream timeout;
- relays JSON status/body responses and wraps non-JSON upstream errors in the
  frontend error envelope; and
- returns `503` when the upstream is unavailable or not configured.

The proxy is not an authorization boundary. Go revalidates the Supabase token,
organization membership, role, organization status, and location scope.

## 3. Routing and page map

| Area | Routes | Responsibility |
|---|---|---|
| Public/auth | `/`, `/login`, `/login/seller`, `/login/buyer`, `/register`, `/auth/*` | Landing, login/register portals, OAuth callback, password recovery/reset, logout |
| Seller workspace | `/dashboard`, `/pos`, `/pos/history`, `/register-sessions`, `/products`, `/stock`, `/settings` | Seller dashboard, checkout, sales history, shifts, catalogue, stock, payment settings |
| Seller status | `/seller/onboarding`, `/seller/pending`, `/seller/rejected`, `/seller/suspended` | Organization provisioning and approval-state screens |
| Buyer experience | `/buyer`, `/buyer/setup`, `/buyer/campaigns`, `/buyer/wallet`, `/buyer/receipts/:id` | Buyer profile, campaign discovery/claims, rewards, receipts |
| Privacy/admin | `/privacy`, `/privacy/requests`, `/admin/privacy-requests`, `/admin/seller-applications` | Privacy notice/requests and platform administration |
| PWA/support | `/offline`, `/manifest.webmanifest`, `/llms.txt`, `/ai-catalog.json` | Offline fallback, install metadata, agent-discovery assets |

`middleware.ts` delegates to `shared/lib/supabase/middleware.ts`. It refreshes
the Supabase session for non-public navigation, leaves API requests and auth
routes to their own handlers, and redirects unauthenticated navigation to
`/login`. Seller layout guards are a UX routing layer; capability, membership,
approval, and tenant checks remain server-enforced by Go.

## 4. Authentication and workspace state

1. Supabase Auth handles email/password, Google OAuth when enabled, password
   recovery, session refresh, and sign-out.
2. `/auth/callback` exchanges the OAuth code, preserves a safe `next` path, and
   keeps buyer intent when the login started in the buyer portal.
3. `PosUserProvider` reads the browser session, calls `GET /api/v1/pos/bootstrap`,
   and stores the authenticated user, capabilities, organization, and offline
   scope in memory.
4. A transient API/network failure does not immediately evict an already-open
   seller workspace. A real Supabase sign-out clears the user, capabilities,
   organization, and offline product scope.
5. The Go API derives organization and location scope from verified membership;
   frontend route params and request bodies are not trusted for tenancy.

Do not add local JWT, password-hash, database URL, service-role, or backend
secret handling to this repository. Public Supabase URL/key values may be
browser-configured; server-only `GO_API_BASE_URL` is preferred for the proxy.

## 5. API consumers

| Client module | Main backend paths | Main consumers |
|---|---|---|
| `auth.ts`, `bootstrap.ts` | `/pos/auth/me`, `/pos/bootstrap`, `/pos/auth/logout` | Login, shell, user provider |
| `sellerOrgs.ts` | `/seller-organizations*`, `/admin/seller-applications*` | Seller onboarding, status, settings, admin |
| `products.ts`, `categories.ts`, `suppliers.ts` | `/pos/catalogue/*` | Product list/editor, POS search, stock |
| `registers.ts` | `/pos/registers`, `/pos/shifts`, open/close routes | Register sessions, dashboard, checkout |
| `sales.ts`, `customers.ts` | `/pos/sales*`, `/pos/customers/resolve`, `/pos/sync/sales` | Checkout, history, receipts, offline worker |
| `inventory.ts`, `stock.ts` | `/pos/inventory*`, `/pos/inventory/receipts` | Stock screen and receive-stock flow |
| `rewards.ts`, `receipts.ts` | `/buyer/rewards/*`, `/buyer/receipts/*` | Buyer wallet, dashboard, receipt detail |
| `campaigns.ts` | `/buyer/reward-campaigns/*`, `/buyer/reward-claims*` | Buyer offers, claim detail, receipt confirmation |
| `identity.ts`, `privacy.ts` | `/me/*`, `/locations`, `/account/security/audit`, `/admin/privacy/*` | Profile, location, privacy, recovery audit, admin |

The canonical request/response schemas are in the backend OpenAPI document.
`shared/lib/api/_map.ts` adapts backend DTOs into UI-facing product, register,
sale, and tender types. Money remains integer paise in transport; display
converts it to rupees. Quantities are converted between sale units and backend
base units by `shared/lib/units.ts`.

## 6. Seller workflows

### Catalogue and stock

- Product reads are organization-scoped and can be cached locally for offline
  browsing.
- Product create/edit is online-only and requires the backend role policy.
- The Go API owns SKU/barcode identity, prices, tax, availability, and stock
  correctness.
- Product images are uploaded directly from the browser to the public-read
  Supabase Storage `product-images` bucket, using a category slug and UUID;
  the resulting URL is sent to the Go API.
- Stock receipt, inventory adjustment, product archival, and price changes are
  server operations; they are not fabricated as offline mutations.

### Register and sale

- A seller resolves the organization and open register through bootstrap and
  register APIs before checkout.
- Online sale creation sends an idempotency key. The Go API recomputes prices,
  tax, discounts, stock allocation, totals, payments, reward posting, and
  receipt identity in its transaction.
- Cash, manually recorded UPI/card, and split tender are online payment
  records; no payment gateway is verified by this frontend.
- History merges active local offline rows with server sales and hides local
  rows after successful synchronization.
- Voids and returns are online compensating operations and do not delete the
  original sale history.

## 7. Offline POS implementation

Offline support is browser-local and cash-only. The server remains the final
authority for stock, register state, authorization, and accounting.

### IndexedDB stores

- Database `komola-offline-pos-v1`, schema version `2`.
- Stores: `sales`, `outbox`, `contexts`, `meta`, and `heldCarts`.
- Product snapshots use `komola-offline-products-v1` and the `catalogues` store.
- Every record is scoped by user, organization, and location. Scope changes
  prevent one seller or tenant from reading another seller's local data.
- Local cash checkout commits the sale, receipt number, cash/change, outbox
  entry, and receipt sequence atomically.

### Synchronization

- `OfflineSalesSyncWorker` runs on workspace mount, online transitions, local
  sale changes, and every 30 seconds.
- It refreshes the product snapshot, rechecks previously blocked stock rows,
  claims at most 10 outbox operations with a lease, and posts them to
  `POST /api/v1/pos/sync/sales`.
- Upload outcomes are accepted, already accepted, retry, or rejected. Rejected
  rows become actionable blocked records; auth failures become `auth_required`.
- Retry uses bounded exponential backoff with jitter and honors `Retry-After`.
- Leases expire and can be reclaimed after a tab/browser crash. Idempotency
  prevents duplicate server sales.
- Sellers can inspect, repair customer details or lines, retry, cancel local
  records, open local receipts, export JSON backup, and clean old synced data.

Offline does not promise shared multi-device stock correctness. A second device
may consume stock before the first device reconnects; the server can reject the
offline operation and the seller must repair or cancel it.

## 8. PWA and caching

- `app/manifest.ts` defines standalone mode, `/pos` start URL, portrait
  orientation, theme/background colors, and 192/512px icons.
- `ServiceWorkerRegistration` registers `/sw.js` only in production and emits a
  refresh-ready event when a new worker is waiting.
- `public/sw.js` caches only same-origin public shell/static assets and the
  offline route. It never caches API, auth, login, registration, personalized
  seller/buyer/admin pages, or payment/account flows.
- `PwaStatusBar` distinguishes browser offline, server unavailable, pending
  sync attention, and authentication-required sync.
- `PwaInstallPrompt` supports browser install prompts and iOS Add to Home
  Screen guidance, with dismissal persistence and standalone detection.
- Logout sends `Clear-Site-Data` for cache/storage cleanup through the logout
  route. Offline financial records must still be reviewed against the documented
  account-switching and recovery policy before changing cleanup behavior.

## 9. Configuration and deployment

| Variable | Purpose |
|---|---|
| `GO_API_BASE_URL` | Preferred server-side Go API target; development is pinned to localhost |
| `NEXT_PUBLIC_API_URL` | Public Go API alias |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CATALOGUE_API_BASE_URL` | Backward-compatible API aliases |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_KOMOLA_SUPABASE_URL` | Public Supabase Auth/Storage origin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / anon aliases | Public Supabase browser key |
| `NEXT_PUBLIC_SITE_URL`, `APP_URL` | Canonical site and auth redirect configuration |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` and KOMOLA alias | Google login UI flag |

Netlify builds the Next app using the repository scripts. No database migration
runs from this repository. Apply backend migrations from `go-api-backend`, then
start the Go API and point the POS proxy at it.

## 10. Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

For backend contract verification, run `go test ./...`, `go vet ./...`, and the
backend migration/OpenAPI checks from `go-api-backend`. For browser QA, verify
seller login/onboarding, register open/close, online cash sale, history, void,
return, offline cash sale, reconnect/sync, local receipt recovery, account
switching, PWA install/update, and buyer campaign/claim/receipt flows.

## 11. AI change checklist

Before changing this app:

1. Determine whether the change belongs in the UI, typed client, Next proxy,
   Go API, or database migration; do not put business authorization in the
   frontend.
2. Check the backend OpenAPI route and response envelope before adding a new
   client shape.
3. Preserve bearer/cookie forwarding, idempotency keys, tenant headers, and
   `no-store` behavior in the proxy.
4. For checkout/offline changes, preserve integer paise, canonical quantities,
   operation idempotency, IndexedDB atomicity, lease recovery, and server-final
   conflict handling.
5. Review service-worker cache rules for cross-account leakage before caching
   any route or response.
6. Update the closest document and this reference, then run the four frontend
   checks above.
