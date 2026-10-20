# KOMOLA POS PWA implementation plan

Updated: 2026-10-20
Owner: KOMOLA POS engineering  
Status: PWA and scoped offline POS code is implemented through Phase 6; production/device verification remains
pending. Service-worker updates use a waiting-worker/user-activation flow and
cache version `komola-pos-shell-v4`; see `docs/OFFLINE-DEVICE-TEST-MATRIX.md`
and `docs/OFFLINE-OPERATIONS-RUNBOOK.md` for the required physical checks.

## Objective

Make KOMOLA POS installable on Android, iPhone, and desktop as a Progressive Web
App while preserving the security of authenticated seller data. The first PWA
release is for an app-like online POS experience. It must not imply that every
POS operation works offline.

## Current implementation

| Area | Current state | Evidence |
| --- | --- | --- |
| Web app manifest | Implemented through Next.js metadata route | `app/manifest.ts` |
| Standalone display | Implemented | `display: "standalone"` |
| Theme and background colors | Implemented | Manifest and `app/layout.tsx` |
| Service worker | Implemented and versioned | `public/sw.js` |
| Service-worker registration | Implemented in production builds | `shared/components/ServiceWorkerRegistration.tsx` |
| Offline fallback | Implemented | `app/offline/page.tsx` |
| Navigation/static caching | Implemented with same-origin restrictions | `public/sw.js` |
| Auth/API protection | Implemented: API, auth, login, and registration paths are not cached | `public/sw.js` |
| POS data recovery | Implemented for the scoped, cash-only offline POS flow; pilot and production verification remain | `docs/OFFLINE-STATUS.md`, `docs/OFFLINE-PILOT-PLAYBOOK.md` |
| Install prompt UI | Implemented for browser prompts and iOS guidance | `shared/components/PwaInstallPrompt.tsx` |
| Dedicated PWA icon set | Implemented with 192px, 512px, and maskable declarations | `app/manifest.ts`, `public/icons/` |
| Production device verification | Pending | Release gate below |

## Product boundary

### In scope for the first PWA release

- Install KOMOLA POS from a supported browser.
- Open POS in a standalone app window without browser chrome.
- Restore the public shell and approved cached routes during temporary network
  loss.
- Provide a clear online/offline state to the seller.
- Keep authenticated API responses, OAuth callbacks, and account routes out of
  the service-worker cache.
- Preserve pending offline records according to the offline POS policy.

### Not automatically included

- Offline Google login, password recovery, or new account registration.
- Offline UPI, card, split payments, refunds, reward redemption, product edits,
  or inventory adjustments.
- Background uploads after the browser or operating system has terminated the
  app.
- Native features such as push notifications, camera scanning, or Bluetooth
  printing unless separately implemented and tested.

See [Offline feature status](./OFFLINE-STATUS.md) and the [offline POS proposal](./OFFLINE-POS-PROPOSAL.md)
for the separate authorization, storage, financial, and synchronization gates.

The offline implementation history is recorded in [Offline feature status](./OFFLINE-STATUS.md).
Phases 1–6 describe code delivered so far; the pending list in that document is
the source of truth for production-readiness gaps and pilot work.

## Implementation worklist

### PWA-01 — Complete the manifest and icon set

Status: **Implemented; browser/device verification pending**

- Generate branded PNG icons at `192x192` and `512x512`.
- Add a maskable icon variant with safe padding around the KOMOLA mark.
- Add `id`, `scope`, `orientation`, and suitable `categories` to the manifest.
- Reference the icons with the correct `sizes`, MIME type, and purposes (`any`
  and `maskable`).
- Add an Apple touch icon that remains legible on iOS.
- Confirm that the manifest starts at `/pos` and that unauthenticated users are
  redirected to the appropriate login portal without losing installability.

Acceptance criteria:

- Chrome Application > Manifest reports no missing required icon sizes.
- The icon is recognizable at launcher size on Android, iOS, and desktop.
- The installed app opens at `https://komola.in/pos`.

### PWA-02 — Add an install experience

Status: **Implemented; browser/device verification pending**

- Add a client-side install prompt that listens for `beforeinstallprompt`.
- Show an unobtrusive “Install KOMOLA” action only when the browser exposes a
  deferred install event.
- Store dismissal state locally so the prompt does not interrupt every visit.
- Detect an already-installed standalone display mode and hide the prompt.
- Provide a short iPhone instruction panel because iOS Safari does not expose
  the same install prompt API.
- Keep installation optional; never block login or checkout on installation.

Acceptance criteria:

- Android Chrome can install from the in-app prompt.
- Desktop Chrome/Edge can install from the address-bar or in-app prompt.
- iPhone Safari users receive accurate Add to Home Screen instructions.
- The prompt does not appear for users already running the installed app.

### PWA-03 — Harden service-worker lifecycle and caching

Status: **Implemented; production verification pending**

- Keep the cache name versioned and document the upgrade process.
- Cache only public shell/static assets and explicitly prepared POS routes.
- Never cache Supabase sessions, OAuth callbacks, authenticated API responses,
  personalized HTML, or password-reset routes.
- Verify that a failed asset refresh does not delete the previously working
  shell.
- Add an update notification or controlled refresh when a new service worker is
  waiting.
- Ensure an IndexedDB migration or service-worker update cannot delete pending
  financial records.
- Confirm same-origin checks and cache size limits on mobile devices.

Acceptance criteria:

- A network panel audit shows no authenticated API or auth response in the PWA
  cache.
- A service-worker update preserves pending carts, receipts, and outbox entries.
- A failed deployment or asset request falls back safely to the last usable
  shell or `/offline`.

### PWA-04 — Make the online/offline state clear

Status: **Implemented; production verification pending**

- Keep the existing offline route and local POS status indicators.
- Add a persistent but compact connection indicator in the seller shell.
- Distinguish “browser is offline”, “server unavailable”, “pending sync”, and
  “authorization expired”.
- Do not use `navigator.onLine` as proof that the API is reachable; confirm with
  real request outcomes.
- Make it impossible to present a locally saved sale as server-confirmed.

Acceptance criteria:

- A seller can see whether a sale is local/pending or synchronized.
- Reconnection triggers bounded retries without duplicate sales.
- A failed sync gives an actionable state and preserves the original receipt.

### PWA-05 — Validate authenticated POS startup

Status: **Planned**

- Test cold launch, warm launch, login redirect, and standalone launch.
- Confirm Supabase OAuth redirects remain on `https://komola.in`.
- Keep new login and password recovery online-only.
- Confirm account switching never exposes cached data from another seller or
  organization.
- Measure startup using the existing performance targets in
  `docs/PERFORMANCE-STARTUP.md`.

Acceptance criteria:

- A signed-in seller can reopen the installed app and reach POS reliably.
- A signed-out user cannot read private cached POS data.
- Google login, email login, logout, and password recovery work from the normal
  browser and installed-app flows.

### PWA-06 — Device and browser verification

Status: **Planned**

Test at minimum:

| Platform | Browser | Required checks |
| --- | --- | --- |
| Android | Chrome | Install, standalone launch, update, reconnect, camera/scan if enabled |
| iPhone | Safari | Add to Home Screen, launch, login, viewport, receipt flow |
| Windows/macOS | Chrome or Edge | Install, update, keyboard/mouse, printing |
| macOS/iPadOS | Safari | Standalone behavior, auth redirect, responsive layout |

Also test private browsing, storage denial, low storage, browser restart,
multiple tabs, service-worker update, and a revoked/expired session.

## Security and data rules

- The service worker must not cache bearer tokens, Supabase session responses,
  password-reset links, or tenant-scoped API responses.
- PWA installation is not an authorization mechanism. Every API request still
  requires normal authentication and server-side organization/role checks.
- A device that is shared by multiple sellers must not expose one seller’s
  local records to another seller.
- Pending customer, sale, and reward data must use the same retention, export,
  deletion, and DPDP controls as the browser application.
- Do not describe cached or locally queued sales as completed until the server
  acknowledges them.
- Do not enable offline financial writes for unprepared devices until the
  offline authorization and recovery gates in `docs/OFFLINE-STATUS.md` pass.

## Release checklist

- [x] PWA icons generated and referenced at 192px and 512px.
- [x] Manifest metadata and install prompt implemented.
- [x] iPhone Add to Home Screen guidance implemented.
- [x] Service-worker cache changed to avoid personalized-page caching.
- [ ] Service-worker update preserves IndexedDB pending records.
- [ ] Google login and password recovery verified on `komola.in`.
- [ ] Standalone POS launch verified on Android, iPhone, and desktop.
- [ ] Offline shell, reconnect, pending sync, and error states verified.
- [ ] Storage-denial and low-storage behavior verified.
- [ ] Lighthouse/PWA audit completed on the production deployment.
- [ ] No offline feature is advertised beyond the approved offline POS scope.
- [ ] Deployment, rollback, and cache-busting procedure recorded.

## Suggested delivery order

1. Complete PWA-01 icon and manifest work.
2. Implement PWA-02 install UX.
3. Complete PWA-03 cache/update hardening.
4. Verify PWA-04 status and pending-sale messaging.
5. Run PWA-05 and PWA-06 on the production domain.
6. Only then decide whether the offline financial gates justify enabling more
   offline checkout behavior.

This document is an implementation tracker, not a claim that all listed
features are currently production-ready.

## Execution strategy under the current constraints

The requested implementation scope is limited to `komola-pos` frontend/PWA
code and documentation. The following are explicitly out of scope:

- Go API or any API contract changes.
- Database schema, migrations, queries, or data changes.
- Environment variable changes.
- `komola-rewardor` changes.
- Mobile application changes.

### Critical issue to resolve before production installation

The current service worker caches same-origin navigation responses and also
receives authenticated route URLs through `CACHE_URLS`. Although API and auth
paths are excluded, this can still cache personalized POS HTML. Before broad
PWA rollout, the service worker must be verified and hardened so one seller
cannot receive another seller's cached page after logout, account switching,
or shared-device use. This is a security gate, not an optional polish task.

No implementation should be considered production-ready until this cache
boundary is tested with two seller accounts and a signed-out browser session.

## Candidate implementation plans

### Plan A — Installable PWA minimum

Lowest-risk, smallest change set.

Tasks:

1. Generate and add 192px, 512px, maskable, and Apple touch icons.
2. Complete the manifest metadata and icon declarations.
3. Add an install button for browsers that support `beforeinstallprompt`.
4. Add iPhone Add to Home Screen guidance.
5. Run production installability and device checks.

Expected result: KOMOLA POS can be installed and opened as an app, but the
existing service-worker behavior remains subject to the critical cache review.

Estimated risk: low, after the cache gate is reviewed.  
Does not touch API, database, environment variables, mobile, or Rewardor.

### Plan B — Recommended secure PWA release

Plan A plus the production safety work needed for a seller-facing app.

Tasks:

1. Complete all Plan A tasks.
2. Harden service-worker caching to avoid personalized HTML leakage.
3. Add controlled service-worker update handling and cache-version cleanup.
4. Add clear online, server-unavailable, pending-sync, and authorization-expired
   states in the POS UI.
5. Verify logout, account switching, shared-device use, and stale-session flows.
6. Run the complete Android, iPhone, desktop, reconnect, and storage test matrix.
7. Update this tracker with evidence and release status.

Expected result: a secure, installable, online-first PWA with clearly bounded
offline behavior.

Estimated risk: medium, because service-worker changes can affect reloads and
cached navigation.  
Does not touch API, database, environment variables, mobile, or Rewardor.

### Plan C — Full offline POS expansion

Plan B plus broader offline checkout and synchronization behavior.

This plan is not suitable under the current constraints. A trustworthy full
offline POS requires server-side authorization, idempotent synchronization,
inventory reconciliation, historical pricing/lot policy, and recovery rules.
Those areas may require API and database work, which is explicitly prohibited
for this task. It should be planned separately if those restrictions change.

## Approval gate

Implementation will begin only after one plan is approved. The recommended
choice is **Plan B — Recommended secure PWA release** because it delivers the
installable app while addressing the service-worker privacy risk first.

After approval, work will be delivered in small chunks in this order:

1. PWA-01 icons and manifest.
2. PWA-02 install experience.
3. Critical service-worker cache hardening.
4. PWA-04 status and pending-sync messaging.
5. Device verification and tracker updates.

Each chunk will be validated independently. No API, database, environment,
mobile, or Rewardor files will be changed.
