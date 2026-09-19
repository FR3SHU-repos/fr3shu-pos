# POS startup and reload performance

Updated 2026-09-19. Render the authenticated application shell first:
navigation, header, stable layout, buttons, and skeleton content. Profile,
permissions, register, sales, catalogue, and offline data arrive afterward.

Targets at the 75th percentile: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, and
TTFB preferably below 800ms.

## Current implementation

- OAuth callback redirects without waiting for seller-organization status.
- `SellerShell` renders while `PosUserContext` hydrates the user.
- Offline workers mount only after authenticated user scope is available.
- `shared/lib/api/client.ts` deduplicates simultaneous GET requests.
- Go authenticated GET responses use private short-lived cache headers with
  `Vary: Authorization, Cookie`.
- Catalogue reads cache for 60 seconds; identity reads for 30 seconds;
  register/shift reads for 5 seconds; other reads for 15 seconds.
- PostgreSQL already has the principal catalogue, register, inventory, and
  movement indexes. Add new indexes only after checking query plans.

## Rules

- Never cache POST, PATCH, DELETE, checkout, payment, inventory mutation, or
  authentication responses.
- Never use a shared/public CDN cache for tenant or user-scoped responses.
- Do not block the initial shell on dashboard data.
- Do not introduce Redis solely to fix one-user reloads.
- Do not add an index without `EXPLAIN (ANALYZE, BUFFERS)` evidence.

## Layers

1. Service-worker/static shell cache.
2. Private browser HTTP cache for authenticated GETs.
3. In-flight request deduplication in the typed API client.
4. IndexedDB for offline catalogue and financial recovery data.
5. PostgreSQL indexes and query plans.
6. Redis only if measured multi-user shared reads justify it.

## TanStack Query

TanStack Query can later provide stale-while-revalidate, invalidation,
background refetching, retries, and shared server state. It is not required yet
because the client already deduplicates requests and the API supplies private
cache headers. If adopted, use it for read-only server state, keep mutations in
typed API clients, define one freshness policy per resource, and keep IndexedDB
separate for offline financial records.

## Verification

- Measure redirect count, TTFB, DOM interactive, and load timings.
- Test cold login, warm reload, Safari, mobile 4G, and offline/reconnect.
- Check for duplicate auth, capability, organization, register, and sales
  requests in the browser network panel.
- Verify `Cache-Control` and `Vary` headers.
- Use `EXPLAIN (ANALYZE, BUFFERS)` before adding indexes.
- Track Core Web Vitals with real-user monitoring.
