# KOMOLA POS documentation index

This directory contains the current frontend implementation notes and design
records for `komola-pos`.

## Source-of-truth order

When documentation disagrees, use this order:

1. `app/` route handlers, layouts, pages, and `middleware.ts` for frontend
   routing and UI behavior.
2. `shared/lib/api/` and `shared/lib/offline/` for the typed HTTP boundary,
   DTO mapping, browser persistence, and synchronization behavior.
3. `go-api-backend/openapi/openapi.yaml` and
   `go-api-backend/docs/api-current.md` for the canonical API contract.
4. `go-api-backend/db/migrations/*.sql` for PostgreSQL schema and migration
   state.
5. Tests in `tests/` for executable frontend invariants.
6. Documents here for explanation and navigation.
7. `../cross-platform-assets/` for shared architecture and product context.

`API.md`, the lower sections of `POS-PROJECT-CONTEXT.md`, `DECISIONS.md`, and
the older design briefs contain historical or proposed material. They are not
the active API or persistence contract.

## Start here

| Question | Read first |
|---|---|
| What is running in the POS app? | [`system-reference.md`](system-reference.md) |
| How does the browser reach Go? | [`system-reference.md`](system-reference.md) and `shared/lib/api/go-proxy.ts` |
| Which API routes does POS consume? | [`../../go-api-backend/docs/api-current.md`](../../go-api-backend/docs/api-current.md) and [`../../go-api-backend/openapi/openapi.yaml`](../../go-api-backend/openapi/openapi.yaml) |
| How does authentication and tenant scope work? | [`system-reference.md`](system-reference.md), `shared/lib/supabase/middleware.ts`, and `shared/context/PosUserContext.tsx` |
| What works offline? | [`OFFLINE-STATUS.md`](OFFLINE-STATUS.md) and [`system-reference.md`](system-reference.md) |
| What POS edge cases must be handled? | [`POS-EDGE-CASE-ANALYSIS.md`](POS-EDGE-CASE-ANALYSIS.md) |
| How does the PWA cache data safely? | [`PWA-IMPLEMENTATION.md`](PWA-IMPLEMENTATION.md) and `public/sw.js` |
| What are the performance rules? | [`PERFORMANCE-STARTUP.md`](PERFORMANCE-STARTUP.md) |
| How are product images handled? | [`PRODUCT-IMAGES.md`](PRODUCT-IMAGES.md) and `shared/lib/supabase/product-images.ts` |
| What is historical/proposed? | [`API.md`](../API.md), [`POS-PROJECT-CONTEXT.md`](../POS-PROJECT-CONTEXT.md), and the design briefs |

## Update rule

Whenever a frontend route, API client, auth redirect, environment variable,
offline state, service-worker cache rule, product-image rule, or user-visible
workflow changes, update the closest detailed document and
[`system-reference.md`](system-reference.md). Keep backend contract changes in
`go-api-backend`; do not duplicate the full OpenAPI specification here.
