<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KOMOLA POS agent rules

Before starting work, read:

1. [`../cross-platform-assets/common/AGENT_WORKFLOW.md`](../cross-platform-assets/common/AGENT_WORKFLOW.md).
2. [`README.md`](README.md), [`docs/README.md`](docs/README.md), and
   [`docs/system-reference.md`](docs/system-reference.md).
3. [`GIT_RULES.md`](GIT_RULES.md) before creating commits, tags, or pushes.
4. The Go API contract in
   [`../go-api-backend/docs/api-current.md`](../go-api-backend/docs/api-current.md)
   and [`../go-api-backend/openapi/openapi.yaml`](../go-api-backend/openapi/openapi.yaml)
   when changing API behavior.
5. [`../cross-platform-assets/common/DPDP_DATA_GOVERNANCE.md`](../cross-platform-assets/common/DPDP_DATA_GOVERNANCE.md)
   before changing identity, authentication, checkout, rewards, claims,
   analytics, retention, exports, integrations, or account deletion.
6. [`../cross-platform-assets/common/KOMOLA_UI_UX_DESIGN_SYSTEM.md`](../cross-platform-assets/common/KOMOLA_UI_UX_DESIGN_SYSTEM.md)
   before creating or changing any screen, component, interaction, or visual
   theme.

## Architecture and ownership

- This is the Next.js/React POS client. It communicates with application data
  through `shared/lib/api` and the same-origin proxy at
  `app/api/v1/[...path]/route.ts`.
- The proxy is an HTTP relay only. Do not add database queries, business rules,
  authorization decisions, or a second application database to the frontend.
- Supabase Auth owns browser identity/session operations; the Go API owns
  authorization, organization scope, inventory, money, rewards, claims, and
  privacy decisions.
- Browser IndexedDB, service-worker caches, and offline queues are recovery and
  synchronization mechanisms, not the system of record. Mutations must remain
  idempotent and reconcile through the documented API.

## Product invariants

- Do not calculate authoritative prices, stock, taxes, reward values,
  eligibility, quotas, settlement, or claim status in the client.
- POS sales must support the documented verified buyer-code flow or explicit
  guest/walk-in flow; never silently invent buyer identity.
- Preserve offline safeguards, idempotency keys, retry behavior, and visible
  synchronization state when changing checkout or sales history.
- Use semantic design tokens from `app/globals.css`; keep reusable code in the
  documented `shared/` boundaries.
- Do not reintroduce demo fallback data when an API request fails.

## Change and verification rules

- Inspect `git status` and existing diffs before editing; preserve unrelated
  work.
- Do not change the database, run migrations, delete/anonymize records, or
  alter Supabase/production settings without explicit user confirmation.
- Do not expose secrets or raw personal data in source, logs, tests, fixtures,
  screenshots, or commits.
- Update the closest POS system reference and the backend OpenAPI/API docs when
  a route, API client, auth flow, offline rule, or user-visible workflow
  changes.
- Before handoff, run the focused tests and:

  ```bash
  npm run typecheck
  npm run test
  npm run build
  git diff --check
  ```

Report the checks run and any environment-dependent checks that were not run.
