# KOMOLA POS frontend

Next.js client for the Go POS API. All application data follows:
**Next.js → Go/Gin → Supabase PostgreSQL**. Supabase is used here only for Auth.

Copy `.env.example` to `.env.local`, configure `GO_API_BASE_URL` and the public
Supabase Auth URL/key, then run `npm install` and `npm run dev`. Database URLs,
passwords, service-role keys and seed credentials must never be configured here.

Browser API calls use the typed clients in `shared/lib/api/`. With no public API
alias configured they use the database-free `app/api/v1/[...path]/` proxy; the
public aliases can intentionally point compatible deployments directly at Go.
The upstream URL is resolved from `GO_API_BASE_URL`, `NEXT_PUBLIC_API_URL`, or the older
`NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_CATALOGUE_API_BASE_URL` aliases.
Server auth callbacks also call the configured Go server over HTTP.

Startup/reload performance rules and caching strategy are documented in
[docs/PERFORMANCE-STARTUP.md](docs/PERFORMANCE-STARTUP.md).

For an implementation-derived map of the frontend runtime, routes, typed API
boundary, authentication, offline IndexedDB flow, PWA cache rules, and
configuration, start with [docs/system-reference.md](docs/system-reference.md)
and the [documentation index](docs/README.md).

Supabase Auth owns password login, OAuth, password reset and sign-out. Go verifies
the access token and looks up organization membership in PostgreSQL. UI domain
interfaces are under `shared/interfaces/domain`; they are not database models.

The buyer experience also consumes the shared Rewardor campaign APIs: buyers
see published campaigns for their registered platform location and can create
eligible claims. Campaign authoring remains in the separate `komola-rewardor`
web app; POS remains responsible for seller checkout and future claim
redemption.

Checks: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
See [project context](../cross-platform-assets/project/project-context.md) for
cross-application endpoint consumers, table relationships, units, policies and
pending rollout verification. `API.md` is retained as historical migration
notes; the active HTTP contract lives in the Go backend OpenAPI document.
