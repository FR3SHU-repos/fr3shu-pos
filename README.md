# KOMOLA Organic POS

A seller-side, mobile-first Point of Sale for **verified organic** products, built for
organic brands, FPOs and farmers in Visakhapatnam. Part of the KOMOLA workspace.

> **⚠️ Architecture change (2026-09).** This app no longer has a database or a
> local JWT. `go-api-backend` owns the entire POS runtime; authentication is
> **Supabase Auth** via `@supabase/ssr` cookie sessions (the old `pos_token`
> cookie and the embedded Mongoose models are gone). The browser calls
> `go-api-backend` directly for Supabase-authenticated endpoints and via this
> app's same-origin `/api/v1/pos/*` proxy for POS register/sale calls. Parts of
> this README and of `POS-PROJECT-CONTEXT.md` / `API.md` / `DECISIONS.md` still
> describe the earlier Mongoose "thin vertical slice" and are kept only for
> history — the current source of truth is `go-api-backend/docs/` (see
> `pos-architecture.md`, `authentication.md`).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, semantic design tokens (`app/globals.css`) |
| Data | **None in this app.** `go-api-backend` owns every read/write (MongoDB `farmers_republic` + `fr3sh_pos`). |
| Auth | **Supabase Auth** (`@supabase/ssr`, cookie PKCE sessions); Go API verifies the JWT and is the authorization boundary. |
| Validation | Zod (client-side form hints); the Go API is authoritative. |
| Icons | `lucide-react` |
| Tests | Vitest (pure-function unit tests) |

Money is stored and transported as **integer paise**. Inventory is stored as **integer
base units** (grams / millilitres / count); the sale/display unit is kept separately.

## Prerequisites

- Node.js 24+
- A running `go-api-backend` (local or deployed) and a Supabase project. This app
  has no database and no seed script.

## Setup

```bash
cd fr3shu-pos-webapp
npm install
cp .env.example .env.local     # then fill in real values
```

`.env.local` (never committed) — see [`.env.example`](./.env.example) for the full list:

| var | notes |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **required** — the `go-api-backend` origin (no `/api/v1` suffix). |
| `GO_API_BASE_URL` | optional server-only override for the `/api/v1/pos/*` proxy. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **required** — Supabase project URL + publishable/anon key. |
| `APP_URL` | this app's public URL (OAuth `redirectTo`). |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` / `NEXT_PUBLIC_AUTH_WHATSAPP_ENABLED` | provider button flags (default `false`). |

The service-role key must **never** be added here.

## Commands

```bash
npm run dev         # start dev server (Turbopack)
npm run lint        # eslint (0 errors required)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # production build (Turbopack)
npm start           # serve the production build
```

## Data & demo

There is no local seed. Seller organizations, locations, catalogue, inventory
and sales are created through `go-api-backend`. To stand up a demo seller:

1. Sign in through Supabase (`/login`) and let `/auth/callback` reconcile the
   identity.
2. `POST /api/v1/seller-organizations` (via `shared/lib/api/sellerOrgs.ts`) —
   creates the organization (`Pending`), a first location and an Owner
   membership.
3. An admin approves the organization in `go-api-backend` before it can sell.
4. Add products, prices, lots and inventory through the Go API (later phase).

## Documentation

**Current source of truth — `go-api-backend`:**

- `docs/pos-architecture.md` — databases, seller tenancy, the onboarding saga, endpoints.
- `docs/authentication.md` — Supabase Auth boundary, roles, reconciliation.
- `schemas/pos/` — POS collection/field/index contracts (`fr3sh_pos`).

**Historical (pre-Go-cutover Mongoose slice) — kept for reference only:**

- [`POS-PROJECT-CONTEXT.md`](./POS-PROJECT-CONTEXT.md), [`API.md`](./API.md),
  [`DECISIONS.md`](./DECISIONS.md) — describe the earlier embedded-database
  design; the `pos_token` cookie, `shared/models/mongodb/*` and `npm run seed`
  referenced there no longer exist.

## Deployment notes

- No database. Point `NEXT_PUBLIC_API_BASE_URL` at a deployed `go-api-backend`
  and set the Supabase vars. `go-api-backend` needs a MongoDB replica set;
  this app does not.
- `next build` output is a standard Next.js server; deploy on any Node host.
- Do not commit `.env.local`. `.env.example` ships placeholders only.
