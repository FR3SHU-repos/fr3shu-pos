# FR3SHU Organic POS

A seller-side, mobile-first Point of Sale for **verified organic** products, built for
organic brands, FPOs and farmers in Visakhapatnam. Part of the FR3SH workspace.

> **Scope of this build — thin vertical slice.** One working path end to end:
> auth → minimal multi-tenancy → products & inventory → open a register → fast `/pos`
> checkout with an atomic sale + payment + stock + movement transaction and idempotency.
> Offline PWA sync, reporting, admin verification, returns/day-close UI and deep
> certification enforcement are **deliberately deferred** — see [`DECISIONS.md`](./DECISIONS.md).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, semantic design tokens (`app/globals.css`) |
| Data | MongoDB via Mongoose 8, `mongoDB()` singleton |
| Auth | JWT in a `httpOnly` cookie (`pos_token`) |
| Validation | Zod (server-side) |
| Icons | `lucide-react` |
| Tests | Vitest (pure-function unit tests) |

Money is stored and transported as **integer paise**. Inventory is stored as **integer
base units** (grams / millilitres / count); the sale/display unit is kept separately.

## Prerequisites

- Node.js 24+
- A MongoDB replica set (Atlas works out of the box — transactions require a replica set)

## Setup

```bash
cd fr3shu-pos-webapp
npm install
cp .env.example .env.local     # then fill in real values
```

`.env.local` (never committed):

| var | notes |
|---|---|
| `MONGODB_URI` | point at a database isolated from the other FR3SH apps, e.g. `.../fr3sh_pos` |
| `JWT_SECRET` | long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
| `JWT_EXPIRES_IN` / `JWT_COOKIE_MAX_AGE` | token + cookie lifetime (default `8h` / `28800`) |
| `BCRYPT_SALT_ROUNDS` | default `12` |
| `NEXT_PUBLIC_API_BASE_URL` | empty ⇒ same-origin `/api/v1`. Set to the FR3SH Go/Gin service to swap backends. |
| `POS_CASH_VARIANCE_NOTE_THRESHOLD_PAISE` | variance above which a close note is mandatory (default `20000` = ₹200) |
| `SEED_*` | optional fixed dev credentials; otherwise the seed generates and prints them |

## Commands

```bash
npm run dev         # start dev server (Turbopack)
npm run seed        # wipe this app's collections and load demo data; prints credentials
npm run lint        # eslint (0 errors required)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # production build (Turbopack)
npm start           # serve the production build
```

## Seed & demo

`npm run seed` creates: 1 platform Admin, a Brand + FPO + Farmer organisation, 2 locations
(`GHBR1`, `GHMVP`), 2 registers, one user per role, categories, three certifications
(valid NPOP / expiring PGS / pending), six organic products sold by kg / litre / bunch /
pack, two lots per staple with different expiry dates, opening inventory at `GHBR1`, and
one demo sale executed through the real transactional service.

Credentials are printed at the end of the seed run. `SEED_ADMIN_PASSWORD`,
`SEED_OWNER_PASSWORD` and `SEED_CASHIER_PASSWORD` can pin the important ones.

## Pilot checklist (configure a real seller)

1. **Seed or create** a `SellerOrganization` (`type` Brand / FPO / Farmer), then set it
   `status: "Approved"`.
2. Add at least one **`Location`** (unique `code` within the org) and one **`POSRegister`**
   at that location.
3. Create **users**: one `Owner` (all locations), and `Cashier` / `InventoryManager`
   scoped to a location via `locationIds`.
4. Add a **`Certification`** (`verificationStatus: "Approved"`, valid dates) and reference
   it from each **`Product`**; set the product's `organicStatus` to `Verified` only when
   the certificate is genuinely approved and in-window.
5. Add a **`ProductPrice`** row per product per location (paise), or a `basePricePaise`
   fallback on the product.
6. **Receive lots** at the location (`/inventory/lots`) — this writes the `InventoryBalance`
   and an opening/receipt `StockMovement`.
7. **Open a register** with opening cash (`/register-sessions`), then sell from `/pos`.
8. **Close the register** at end of day; enter counted cash and a note if variance is large.

## Documentation

- [`POS-PROJECT-CONTEXT.md`](./POS-PROJECT-CONTEXT.md) — architecture, roles, data model,
  workflows, ER diagram, and the Go/Gin migration boundary.
- [`API.md`](./API.md) — every `/api/v1` route, payloads, auth and idempotency rules.
- [`DECISIONS.md`](./DECISIONS.md) — assumptions, trade-offs, and what was deferred.

## Deployment notes

- Needs a MongoDB **replica set** (Atlas). Standalone `mongod` cannot run the sale
  transaction.
- `next build` output is a standard Next.js server; deploy on any Node host.
- Do not commit `.env.local`. `.env.example` ships placeholders only.
