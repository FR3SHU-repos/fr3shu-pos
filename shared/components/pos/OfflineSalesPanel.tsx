"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Printer, ReceiptText, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import { usePosUser } from "@/shared/context/PosUserContext";
import { salesApi } from "@/shared/lib/api";
import { formatPaise } from "@/shared/lib/money";
import {
  cancelOfflineSale,
  cleanupOfflineSales,
  exportOfflineSales,
  listOfflineSales,
  repairOfflineSaleLines,
  requeueOfflineSale,
  updateOfflineSaleCustomer,
  type OfflineSaleRecord,
  type OfflineScope,
  offlineSaleToDTO,
  type OfflineSaleSyncState,
} from "@/shared/lib/offline/sales";
import { StatusBadge, ghostBtnCls, primaryBtnCls } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { OFFLINE_SALES_SYNC_EVENT, offlineSalesLastSyncKey, type OfflineSalesSyncDetail } from "@/shared/components/pos/OfflineSalesSyncWorker";

const STATUS_LABEL: Record<OfflineSaleSyncState, string> = {
  pending: "waiting",
  uploading: "uploading",
  retry_wait: "retry",
  synced: "completed",
  blocked: "blocked",
  cancelled: "cancelled",
  needs_review: "blocked",
  auth_required: "sign in",
};

function statusIcon(status: OfflineSaleSyncState) {
  if (status === "blocked" || status === "cancelled" || status === "needs_review" || status === "auth_required") return <AlertCircle className="h-4 w-4 text-status-danger" />;
  return <Clock3 className="h-4 w-4 text-status-warning" />;
}

function downloadOfflineSalesBackup(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `komola-offline-sales-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function OfflineSalesPanel() {
  const { user } = usePosUser();
  const [sales, setSales] = useState<OfflineSaleRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<OfflineSaleRecord | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", customerPhone: "", buyerCode: "", marketingConsent: false });
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairLines, setRepairLines] = useState<Record<string, { qty: string; remove: boolean }>>({});

  const scope = useMemo<OfflineScope | null>(() => {
    if (!user) return null;
    return { userId: user.id, orgId: user.orgId, locationId: user.locationId };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!scope) {
      setSales([]);
      return;
    }
    setSales(await listOfflineSales(scope));
    try {
      setLastSyncAt(localStorage.getItem(offlineSalesLastSyncKey(scope)));
    } catch {
      setLastSyncAt(null);
    }
  }, [scope]);

  const syncNow = useCallback(async () => {
    if (!scope || syncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setMessage("Connect to the internet before syncing offline sales.");
      setOpen(true);
      return;
    }
    setSyncing(true);
    setMessage("Syncing offline sales...");
    const result = await salesApi.syncPendingOfflineSales(scope);
    const syncAt = new Date().toISOString();
    try {
      if (result.synced > 0 || result.attempted > 0) localStorage.setItem(offlineSalesLastSyncKey(scope), syncAt);
      window.dispatchEvent(new CustomEvent<OfflineSalesSyncDetail>(OFFLINE_SALES_SYNC_EVENT, { detail: { ...result, at: syncAt, automatic: false } }));
    } catch {
      /* best effort status update */
    }
    if (result.synced > 0) await cleanupOfflineSales(scope, 0);
    await refresh();
    const latestSales = await listOfflineSales(scope);
    const hasBlockedSale = latestSales.some((sale) => sale.syncState === "blocked" || sale.syncState === "needs_review");
    if (result.attempted === 0 && hasBlockedSale) {
      setOpen(true);
      setMessage("Blocked sales are paused. Open the sale and tap Try again to run automatic checks again.");
    } else if (result.attempted === 0) {
      setMessage("No offline sales are waiting to sync.");
    } else if (result.unavailable) {
      setOpen(true);
      setMessage(result.message ?? "The backend sync endpoint is not available. Restart or update the Go API, then try Sync again.");
      toast.error("Restart or update the Go API, then try Sync again");
    } else if (result.authRequired) {
      setOpen(true);
      setMessage("Sign in again to sync offline sales.");
      toast.error("Sign in again to sync offline sales");
    } else if (result.blocked > 0) {
      setOpen(true);
      const reason = result.blockedMessages?.[0];
      const text = reason
        ? `${result.blocked} offline sale${result.blocked === 1 ? "" : "s"} failed automatic checks: ${reason}`
        : `${result.blocked} offline sale${result.blocked === 1 ? "" : "s"} failed automatic checks. Open the sale to see what needs fixing.`;
      setMessage(text);
      toast.error(text);
    } else if (result.synced > 0) {
      setOpen(false);
      setMessage(`${result.synced} offline sale${result.synced === 1 ? "" : "s"} completed and moved to sales history.`);
      toast.success(`${result.synced} offline sale${result.synced === 1 ? "" : "s"} completed`);
    } else {
      setOpen(true);
      setMessage("Sync did not complete. The sale is still saved locally and will retry.");
      toast.error("Offline sale sync did not complete");
    }
    setSyncing(false);
  }, [refresh, sales, scope, syncing]);

  const trySaleAgain = useCallback(async (operationId: string) => {
    if (!scope || syncing) return;
    const queued = await requeueOfflineSale(scope, operationId);
    await refresh();
    if (!queued) {
      setMessage("This offline sale could not be queued again.");
      toast.error("Offline sale could not be queued again");
      return;
    }
    setMessage("Sale queued for another automatic sync check.");
    if (typeof navigator !== "undefined" && navigator.onLine) {
      await syncNow();
    } else {
      toast.success("Sale will sync when internet returns");
    }
  }, [refresh, scope, syncNow, syncing]);

  const startEditing = useCallback((sale: OfflineSaleRecord) => {
    setEditingId(sale.operationId);
    setEditForm({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone ?? "",
      buyerCode: sale.buyerCode ?? "",
      marketingConsent: sale.marketingConsent,
    });
  }, []);

  const startRepairing = useCallback((sale: OfflineSaleRecord) => {
    setRepairingId(sale.operationId);
    setRepairLines(Object.fromEntries(sale.lines.map((line) => [line.productId, { qty: String(line.qty), remove: false }])));
  }, []);

  const saveLineRepair = useCallback(async (sale: OfflineSaleRecord) => {
    if (!scope || syncing) return;
    setSyncing(true);
    try {
      const changes = sale.lines.map((line) => {
        const repair = repairLines[line.productId];
        return { productId: line.productId, qty: Number(repair?.qty ?? line.qty), remove: Boolean(repair?.remove) };
      }).filter((change, index) => {
        const line = sale.lines[index];
        return change.remove || change.qty !== line.qty;
      });
      await repairOfflineSaleLines(scope, sale.operationId, changes);
      setRepairingId(null);
      setRepairLines({});
      await refresh();
      setMessage("Sale items updated. Syncing again...");
      toast.success("Sale items updated");
      if (typeof navigator !== "undefined" && navigator.onLine) await syncNow();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not update sale items.";
      setMessage(text);
      toast.error(text);
    } finally {
      setSyncing(false);
    }
  }, [refresh, repairLines, scope, syncNow, syncing]);

  const saveCustomerDetails = useCallback(async (operationId: string) => {
    if (!scope || syncing) return;
    setSyncing(true);
    try {
      await updateOfflineSaleCustomer(scope, operationId, editForm);
      setEditingId(null);
      await refresh();
      setMessage("Customer details updated. Syncing again...");
      toast.success("Customer details updated");
      if (typeof navigator !== "undefined" && navigator.onLine) await syncNow();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not update customer details.";
      setMessage(text);
      toast.error(text);
    } finally {
      setSyncing(false);
    }
  }, [editForm, refresh, scope, syncNow, syncing]);

  const cancelLocalSale = useCallback(async (operationId: string) => {
    if (!scope || syncing) return;
    const cancelled = await cancelOfflineSale(scope, operationId);
    await refresh();
    if (!cancelled) {
      setMessage("This offline sale could not be cancelled.");
      toast.error("Offline sale could not be cancelled");
      return;
    }
    setMessage("Offline sale cancelled locally. It will not sync to the database.");
    toast.success("Offline sale cancelled locally");
  }, [refresh, scope, syncing]);

  const exportBackup = useCallback(async () => {
    if (!scope) return;
    const backup = await exportOfflineSales(scope);
    downloadOfflineSalesBackup(backup);
    setMessage(`${backup.sales.length} offline sale record${backup.sales.length === 1 ? "" : "s"} exported from this device.`);
    toast.success("Offline sales backup downloaded");
  }, [scope]);

  const clearOldSynced = useCallback(async () => {
    if (!scope || syncing) return;
    await exportBackup();
    const removed = await cleanupOfflineSales(scope);
    await refresh();
    setMessage(removed > 0 ? `${removed} old synced or cancelled offline sale${removed === 1 ? "" : "s"} cleared after backup download.` : "Backup downloaded. No old synced or cancelled offline sales were ready to clear.");
  }, [exportBackup, refresh, scope, syncing]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const onChange = () => void refresh();
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSalesSyncDetail>).detail;
      if (detail?.at) setLastSyncAt(detail.at);
      void refresh();
    };
    window.addEventListener("komola:offline-sales-changed", onChange);
    window.addEventListener(OFFLINE_SALES_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener("komola:offline-sales-changed", onChange);
      window.removeEventListener(OFFLINE_SALES_SYNC_EVENT, onSync);
    };
  }, [refresh]);

  const active = sales.filter((sale) => sale.syncState !== "synced" && sale.syncState !== "cancelled");
  const waitingCount = active.filter((sale) => sale.syncState === "pending" || sale.syncState === "uploading").length;
  const retryCount = active.filter((sale) => sale.syncState === "retry_wait").length;
  const blockedCount = active.filter((sale) => sale.syncState === "blocked" || sale.syncState === "needs_review").length;
  const authCount = active.filter((sale) => sale.syncState === "auth_required").length;
  if (active.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-surface-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 font-semibold text-foreground-heading"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {statusIcon(active[0].syncState)}
          Offline sales
          <span className="text-foreground-muted">
            {waitingCount} waiting · {retryCount} retry · {blockedCount + authCount} issue{blockedCount + authCount === 1 ? "" : "s"}
          </span>
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="font-semibold text-primary" onClick={() => void exportBackup()}>Export backup</button>
          <button type="button" className="font-semibold text-primary" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide" : "View"}
          </button>
          <button
            type="button"
            className={ghostBtnCls}
            disabled={syncing || (typeof navigator !== "undefined" && !navigator.onLine)}
            onClick={syncNow}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>
      {message ? <p className="mt-2 text-xs text-foreground-muted">{message}</p> : null}
      {active.length > 0 ? <p className="mt-2 text-xs text-foreground-muted">Offline sales sync automatically when internet is available. Completed sales move out of this list and appear in sales history.</p> : null}
      {lastSyncAt ? <p className="mt-1 text-xs text-foreground-muted">Last sync check: {new Date(lastSyncAt).toLocaleString()}</p> : null}
      {open ? (
        <div className="mt-3 max-h-80 overflow-auto divide-y divide-border">
          {active.slice(0, 25).map((sale) => (
            <details key={sale.id} className="py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground-heading">{sale.receiptNo}</p>
                  <p className="text-xs text-foreground-muted">
                    {new Date(sale.createdAt).toLocaleString()} · {sale.customerName || "Customer"} · {sale.lines.length} item{sale.lines.length === 1 ? "" : "s"}
                  </p>
                  {(sale.syncState === "blocked" || sale.syncState === "needs_review") && sale.syncMessage ? (
                    <p className="mt-1 text-xs font-medium text-status-danger">{sale.syncMessage}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-foreground-heading">{formatPaise(sale.totalPaise)}</p>
                  <StatusBadge status={STATUS_LABEL[sale.syncState]} />
                  {sale.syncState === "blocked" || sale.syncState === "needs_review" ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-primary hover:bg-surface"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setReceiptSale(sale);
                        }}
                      >
                        View receipt
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-primary hover:bg-surface"
                        disabled={syncing}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startRepairing(sale);
                        }}
                      >
                        Repair items
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-primary hover:bg-surface"
                        disabled={syncing}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startEditing(sale);
                        }}
                      >
                        Edit customer
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-primary hover:bg-surface"
                        disabled={syncing}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void trySaleAgain(sale.operationId);
                        }}
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-status-danger hover:bg-surface"
                        disabled={syncing}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void cancelLocalSale(sale.operationId);
                        }}
                      >
                        Cancel local
                      </button>
                    </div>
                  ) : null}
                </div>
              </summary>
              <div className="mt-3 space-y-3 rounded-lg bg-surface p-3 text-xs text-foreground-muted">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Detail label="Status" value={STATUS_LABEL[sale.syncState]} />
                  <Detail label="Operation ID" value={sale.operationId} />
                  <Detail label="Customer" value={sale.customerPhone ? `${sale.customerName} · ${sale.customerPhone}` : sale.customerName} />
                  <Detail label="Cash received" value={formatPaise(sale.payment.receivedPaise)} />
                  <Detail label="Sale total" value={formatPaise(sale.payment.amountPaise)} />
                  <Detail label="Change" value={formatPaise(sale.payment.changePaise)} />
                  {sale.lastSyncAttemptAt ? <Detail label="Last sync try" value={new Date(sale.lastSyncAttemptAt).toLocaleString()} /> : null}
                  {sale.syncMessage ? <Detail label="Sync detail" value={sale.syncMessage} /> : null}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ghostBtnCls} onClick={() => setReceiptSale(sale)}>
                    <ReceiptText className="h-4 w-4" />
                    View receipt
                  </button>
                </div>
                {sale.syncState === "blocked" || sale.syncState === "needs_review" ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ghostBtnCls} disabled={syncing} onClick={() => void trySaleAgain(sale.operationId)}>
                      <RefreshCw className="h-4 w-4" />
                      Try again
                    </button>
                    <button type="button" className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-semibold text-status-danger hover:bg-surface" disabled={syncing} onClick={() => void cancelLocalSale(sale.operationId)}>
                      Cancel local sale
                    </button>
                  </div>
                ) : null}
                {repairingId === sale.operationId ? (
                  <div className="rounded-lg border border-border bg-surface-card p-3">
                    <p className="mb-2 font-medium text-foreground-body">Repair product lines before syncing</p>
                    <div className="space-y-2">
                      {sale.lines.map((line) => {
                        const value = repairLines[line.productId] ?? { qty: String(line.qty), remove: false };
                        return (
                          <div key={line.productId} className="grid gap-2 rounded-lg bg-surface p-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div>
                              <p className="font-medium text-foreground-heading">{line.name}</p>
                              <p className="text-foreground-muted">Original {line.qty} {line.saleUnit} · {formatPaise(line.netPaise)}</p>
                            </div>
                            <label className="text-xs font-medium text-foreground-body">
                              New qty
                              <input
                                className="mt-1 w-28 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground-heading"
                                type="number"
                                min="0.001"
                                max={line.qty}
                                step="0.001"
                                disabled={value.remove}
                                value={value.qty}
                                onChange={(event) => setRepairLines((lines) => ({ ...lines, [line.productId]: { ...value, qty: event.target.value } }))}
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-foreground-body">
                              <input
                                type="checkbox"
                                checked={value.remove}
                                onChange={(event) => setRepairLines((lines) => ({ ...lines, [line.productId]: { ...value, remove: event.target.checked } }))}
                              />
                              Remove
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className={ghostBtnCls} disabled={syncing} onClick={() => void saveLineRepair(sale)}>
                        Save and sync
                      </button>
                      <button type="button" className="text-xs font-semibold text-foreground-muted" disabled={syncing} onClick={() => setRepairingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                {editingId === sale.operationId ? (
                  <div className="rounded-lg border border-border bg-surface-card p-3">
                    <p className="mb-2 font-medium text-foreground-body">Edit customer before syncing</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-medium text-foreground-body">
                        Name
                        <input
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-heading"
                          value={editForm.customerName}
                          onChange={(event) => setEditForm((form) => ({ ...form, customerName: event.target.value }))}
                        />
                      </label>
                      <label className="text-xs font-medium text-foreground-body">
                        Indian mobile number
                        <input
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-heading"
                          inputMode="numeric"
                          placeholder="9876543210"
                          value={editForm.customerPhone}
                          onChange={(event) => setEditForm((form) => ({ ...form, customerPhone: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        />
                      </label>
                      <label className="text-xs font-medium text-foreground-body">
                        Buyer code
                        <input
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-heading"
                          placeholder="BYR-XXXXXXXXXX"
                          value={editForm.buyerCode}
                          onChange={(event) => setEditForm((form) => ({ ...form, buyerCode: event.target.value.toUpperCase() }))}
                        />
                      </label>
                      <label className="flex items-center gap-2 self-end text-xs font-medium text-foreground-body">
                        <input
                          type="checkbox"
                          checked={editForm.marketingConsent}
                          onChange={(event) => setEditForm((form) => ({ ...form, marketingConsent: event.target.checked }))}
                        />
                        Marketing consent
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className={ghostBtnCls} disabled={syncing} onClick={() => void saveCustomerDetails(sale.operationId)}>
                        Save and sync
                      </button>
                      <button type="button" className="text-xs font-semibold text-foreground-muted" disabled={syncing} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="mb-1 font-medium text-foreground-body">Items</p>
                  <ul className="space-y-1">
                    {sale.lines.map((line) => (
                      <li key={`${sale.id}:${line.productId}:${line.qtyBase}`} className="flex justify-between gap-3">
                        <span>{line.name} · {line.qty} {line.saleUnit}</span>
                        <span className="shrink-0 text-foreground-body">{formatPaise(line.netPaise)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    {receiptSale ? <OfflineReceiptDialog sale={receiptSale} onClose={() => setReceiptSale(null)} /> : null}
    </section>
  );
}

function OfflineReceiptDialog({ sale, onClose }: { sale: OfflineSaleRecord; onClose: () => void }) {
  const receipt = offlineSaleToDTO(sale);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <div className="mx-auto max-w-md rounded-2xl bg-surface-card p-4 shadow-xl">
        <div className="no-print mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Offline receipt</p>
            <h2 className="text-lg font-semibold text-foreground-heading">{sale.receiptNo}</h2>
            <p className="mt-1 text-xs text-foreground-muted">
              {sale.syncState === "synced" ? "Synced" : "Saved locally until sync completes"}
              {sale.serverReceiptNo ? ` · Server receipt ${sale.serverReceiptNo}` : sale.serverSaleId ? ` · Server sale ${sale.serverSaleId}` : ""}
            </p>
          </div>
          <button type="button" className="rounded-full p-2 text-foreground-muted hover:bg-surface" onClick={onClose} aria-label="Close receipt">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ReceiptView
          sale={receipt}
          payments={[{ method: "Cash", amountPaise: sale.payment.receivedPaise }]}
          changePaise={sale.payment.changePaise}
        />
        <div className="no-print mt-4 grid gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-foreground-muted">
          <Detail label="Sync status" value={STATUS_LABEL[sale.syncState]} />
          {sale.syncMessage ? <Detail label="Sync detail" value={sale.syncMessage} /> : null}
          <Detail label="Local receipt" value={sale.receiptNo} />
          {sale.serverReceiptNo ? <Detail label="Server receipt" value={sale.serverReceiptNo} /> : null}
          {sale.serverSaleId ? <Detail label="Server sale ID" value={sale.serverSaleId} /> : null}
          <Detail label="Operation ID" value={sale.operationId} />
          <Detail label="Cash received" value={formatPaise(sale.payment.receivedPaise)} />
          <Detail label="Change" value={formatPaise(sale.payment.changePaise)} />
        </div>
        <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={ghostBtnCls} onClick={onClose}>Close</button>
          <button type="button" className={primaryBtnCls} onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground-body">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
