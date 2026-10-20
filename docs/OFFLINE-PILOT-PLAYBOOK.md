# Offline POS pilot playbook

Phase 6 is the controlled pilot gate for offline cash sales. The build-time
flag is disabled by default. A deployment must explicitly set
`NEXT_PUBLIC_OFFLINE_POS_PILOT_ENABLED=true` and should also set one or more
organization, location, register, or terminal allowlists.

These values are rollout controls, not secrets. Do not put tokens, passwords,
buyer data, or database credentials in them. Because `NEXT_PUBLIC_*` values are
compiled into the browser bundle, changing them requires a new deployment.

## Pilot setup

1. Select one supported browser/device and one register.
2. Set the pilot flag and the narrowest useful allowlist in the deployment
   environment. Prefer a terminal or register allowlist over enabling an entire
   organization.
3. Deploy and confirm the seller workspace shows `Pilot: enabled`.
4. Open the register, prepare offline mode online, and confirm the readiness
   checklist shows the saved catalogue, storage state, open shift, device
   scope, local PIN, inventory cursor, and grant expiry.
5. Record the device model, browser version, register, location, network type,
   and catalogue size in the pilot log.

## Five-sale acceptance run

With the prepared terminal disconnected:

1. Complete five eligible cash sales, including one sale requiring change.
2. Confirm each local receipt is available for viewing and reprint.
3. Close and reopen the browser while disconnected; confirm the saved receipts
   and pending queue remain available to the same scoped seller, and confirm
   the local six-digit PIN is required before another sale can be created.
4. Reconnect and wait for automatic sync, or use the manual Sync action.
5. Confirm each sale reaches server-confirmed state exactly once, with no
   duplicate receipt, inventory movement, customer side effect, or reward.
6. Compare local receipt totals with the canonical server sales and record the
   sync latency, retries, blocked/review-required outcomes, and session-only
   network diagnostics.

The run is not considered complete until the device matrix, printer check,
low-storage check, and rollback/support drill in the operations runbook have
been recorded. This repository contains the procedures and automated
deterministic tests; a real-device run must be performed by the pilot operator.

## Stop conditions

Disable the pilot flag or remove the allowlist if any of these occur:

- a local sale cannot be recovered or reprinted;
- a sale is duplicated or silently lost;
- server reconciliation changes the recorded amount unexpectedly;
- an unauthorized terminal or register can create an offline sale;
- storage loss, browser update, logout, or account switching exposes another
  seller's pending data;
- repeated stale-price, inventory, authorization, or shift conflicts prevent
  normal operation.

Offline sales remain cash-only. UPI/card/split payments, returns, voids,
product edits, inventory adjustments, reward redemption, and new login remain
online-only during this pilot.
