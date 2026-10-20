# Offline POS operations runbook

## Rollout

1. Use deployment allowlists or a separate pilot deployment if operational
   rollout control is needed; the old pilot flag is not required for local
   checkout in the current build.
2. Complete the device matrix and five-sale acceptance run before broadening
   the supported device scope.
3. Changing `NEXT_PUBLIC_*` values requires a new deployment because they are
   compiled into the browser bundle.
4. Before disconnecting, verify the saved catalogue, storage state, inventory
   cursor, and intended account/location scope. Do not require a separate
   offline-preparation action from the seller.

## Rollback and cache busting

- Pause the affected deployment or narrow its rollout controls and redeploy.
  This does not erase pending receipts or locally committed sales.
- If a broken POS shell is deployed, publish the previous known-good build and
  increment the service-worker cache name in `public/sw.js`. Keep the old
  IndexedDB stores; never delete `sales` or `outbox` as a cache cleanup.
- Ask the operator to reconnect, export the local offline backup, and use the
  visible Sync/Review actions. Do not clear browser storage until support has
  confirmed that the export and server reconciliation are complete.
- A server rollback must preserve the offline sync endpoint, idempotency keys,
  grant tables for legacy clients, and response outcome contract. Database migrations are not
  rolled back from this client runbook.

## Support procedure

Collect:

- device model, operating system, browser/PWA version, app build, register,
  terminal, location, and approximate incident time;
- online/offline state, readiness expiry, storage status, local receipt number,
  operation ID, sync state, reason, and server receipt ID if present;
- exported offline backup and the browser's visible diagnostics only.

Never request or record a Supabase access token, offline grant token, payment
secrets, or unmasked buyer data. Support should first preserve
the local receipt and export, then retry or repair only after checking whether
the server already accepted the operation.

## Incident decision tree

- **No local receipt:** stop the sale flow and do not retry payment blindly;
  check browser storage and the cashier's paper/printed evidence.
- **Local receipt, pending:** keep the record, reconnect, and use Sync.
- **Already accepted:** do not create a replacement; match the server receipt
  by operation ID.
- **Needs review / inventory conflict:** keep the receipt, export it, and
  reconcile stock/lot evidence before repair or cancellation.
- **Authentication or scope error:** sign in to the intended account and
  confirm the register and location scope; never switch accounts while
  unresolved records are being reviewed.
- **Storage full/evicted:** stop accepting offline writes, export what remains,
  free storage, reconnect and resave the catalogue, and document any records
  that were not recoverable.

## Pilot closeout

After five accepted sales, compare local and server receipt IDs, totals,
inventory movements, buyer effects, and reward effects. Record sync latency,
retries, printer result, storage result, and all deviations. Only then widen
the allowlist.
