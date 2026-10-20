# Offline POS pilot playbook

This playbook describes a controlled pilot for offline cash sales. The old
build-time pilot flag and allowlists are retained as deployment documentation,
but they are not customer-facing prerequisites for local checkout. A seller
only needs a signed-in scoped workspace, a usable local catalogue, and safe
browser storage.

These values are rollout controls, not secrets. Do not put tokens, passwords,
buyer data, or database credentials in them. Because `NEXT_PUBLIC_*` values are
compiled into the browser bundle, changing them requires a new deployment.

## Pilot setup

1. Select one supported browser/device and one register.
2. Deploy the current build and confirm the seller workspace has a saved
   catalogue, usable storage, and the intended account/location scope.
3. Do not require the seller to open a preparation screen before disconnecting.
4. Record the device model, browser version, register, location, network type,
   and catalogue size in the pilot log.

## Five-sale acceptance run

With the prepared terminal disconnected:

1. Complete five eligible cash sales, including one sale requiring change.
2. Confirm each local receipt is available for viewing and reprint.
3. Close and reopen the browser while disconnected; confirm the saved receipts
   and pending queue remain available to the same scoped seller. Confirm that
   account switching and logout do not expose the prior scope.
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
- an unauthorized account or scope can access another seller's offline data;
- storage loss, browser update, logout, or account switching exposes another
  seller's pending data;
- repeated stale-price, inventory, authorization, or shift conflicts prevent
  normal operation.

Offline sales remain cash-only. UPI/card/split payments, returns, voids,
product edits, price changes, reward redemption, and new login remain
online-only during this pilot. Product creation and stock receipts may be
queued offline; stock shortfalls become reviewable adjustment records after
sync.
