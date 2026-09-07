# KOMOLA POS frontend

Next.js client for the Go POS API. All application data follows:
**Next.js → Go/Gin → Supabase PostgreSQL**. Supabase is used here only for Auth.

Copy `.env.example` to `.env.local`, configure `GO_API_BASE_URL` and the public
Supabase Auth URL/key, then run `npm install` and `npm run dev`. Database URLs,
passwords, service-role keys and seed credentials must never be configured here.

Browser API calls use the typed clients in `shared/lib/api/` and the database-free
`app/api/v1/[...path]/route.ts` proxy. The upstream URL is resolved from
`GO_API_BASE_URL`, `NEXT_PUBLIC_API_URL`, or the older
`NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_CATALOGUE_API_BASE_URL` aliases.
Server auth callbacks also call the configured Go server over HTTP.

Supabase Auth owns password login, OAuth, password reset and sign-out. Go verifies
the access token and looks up organization membership in PostgreSQL. UI domain
interfaces are under `shared/interfaces/domain`; they are not database models.

Checks: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
See [project context](../cross-platform-assets/project-context.md) for endpoint
consumers, table relationships, units, policies and pending rollout verification.
