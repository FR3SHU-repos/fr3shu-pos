# Offline POS device test matrix

This is the manual acceptance matrix for the remaining device-dependent work.
Automated unit/build tests cannot prove browser eviction, OS network changes,
thermal receipt printing, or an actual five-sale pilot. Record the date,
device, browser version, register, location, network state, and evidence for
each row.

## Required device coverage

| Surface | Minimum run | Pass criteria |
| --- | --- | --- |
| Desktop Chrome/Edge | Online prepare, browser restart, offline five-sale run, reconnect | Receipts remain scoped; grant and register checks hold; sync is exactly once |
| Android Chrome | Same run on a low-end supported device and mobile data | Search/commit targets are met; no data loss after app backgrounding or OS reclaim |
| iPhone Safari/PWA | Add to Home Screen, offline run, Safari/PWA restart, reconnect | Offline route and local receipts open; account scope is preserved; sync recovers |
| Desktop printer | Browser print preview and the supported thermal printer | Receipt is legible, totals match, no application state is lost when printing is cancelled |
| Storage pressure | Browser permission denied, low quota, and simulated IndexedDB failure | Preparation is blocked or actionable; existing receipts can be exported; no partial sale is shown |

## Failure-matrix scenarios

Run each scenario once online and once with the network disabled where the
scenario is eligible for offline operation:

1. Network loss before checkout, during local commit, after local commit, and
   after the server commits but before the response reaches the browser.
2. Duplicate retry, altered operation payload, two open tabs, tab crash, and
   browser restart.
3. Logout, account switch, expired grant, revoked grant, closed shift, and
   changed register/terminal.
4. Changed price/tax/unit, archived product, insufficient stock, changed lot,
   missing lot evidence, invalid inventory cursor, and restored backup.
5. Service-worker update while online, update while offline, failed optional
   shell asset, old worker plus new worker, and cache eviction.

For every failure, verify that the cashier sees an actionable state and that
the local receipt/outbox record remains recoverable. Attach the exported JSON
backup and server receipt IDs to the pilot record; do not attach PINs, bearer
tokens, or buyer secrets.

## Performance measurements

Record p50/p95 for local product search and local sale commit, plus catalogue
download bytes, sync upload bytes, sync latency, retry count, and blocked
count. The initial targets are p95 search under 100 ms and local commit under
500 ms, excluding printer time. Treat a target miss as a pilot follow-up, not
as permission to silently enlarge the offline scope.

Status: the matrix is implemented as a runbook and automated coverage exists
for the deterministic pieces. Real hardware execution remains pending.
