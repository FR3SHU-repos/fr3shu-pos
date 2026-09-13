"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { salesApi } from "@/shared/lib/api";
import { formatPaise } from "@/shared/lib/money";
import {
  listOfflineSales,
  type OfflineSaleRecord,
  type OfflineScope,
  type OfflineSaleSyncState,
} from "@/shared/lib/offline/sales";
import { StatusBadge, ghostBtnCls } from "@/shared/components/ui";

const STATUS_LABEL: Record<OfflineSaleSyncState, string> = {
  pending: "waiting",
  uploading: "uploading",
  retry_wait: "retry",
  synced: "synced",
  needs_review: "review",
  auth_required: "sign in",
};

function statusIcon(status: OfflineSaleSyncState) {
  if (status === "synced") return <CheckCircle2 className="h-4 w-4 text-status-success" />;
  if (status === "needs_review" || status === "auth_required") return <AlertCircle className="h-4 w-4 text-status-danger" />;
  return <Clock3 className="h-4 w-4 text-status-warning" />;
}

export function OfflineSalesPanel() {
  const { user } = usePosUser();
  const [sales, setSales] = useState<OfflineSaleRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
  }, [scope]);

  const syncNow = useCallback(async () => {
    if (!scope || syncing) return;
    setSyncing(true);
    await salesApi.syncPendingOfflineSales(scope);
    await refresh();
    setSyncing(false);
  }, [refresh, scope, syncing]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const onChange = () => void refresh();
    const onOnline = () => void syncNow();
    window.addEventListener("komola:offline-sales-changed", onChange);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("komola:offline-sales-changed", onChange);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, syncNow]);

  const visible = sales.filter((sale) => sale.syncState !== "synced");
  if (sales.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-surface-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 font-semibold text-foreground-heading"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {visible.length > 0 ? statusIcon(visible[0].syncState) : <CheckCircle2 className="h-4 w-4 text-status-success" />}
          Offline sales
          <span className="text-foreground-muted">
            {visible.length > 0 ? `${visible.length} waiting` : `${sales.length} saved`}
          </span>
        </button>
        <div className="flex items-center gap-3">
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
      {open ? (
        <div className="mt-3 max-h-80 overflow-auto divide-y divide-border">
          {sales.slice(0, 25).map((sale) => (
            <div key={sale.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground-heading">{sale.receiptNo}</p>
                <p className="text-xs text-foreground-muted">
                  {new Date(sale.createdAt).toLocaleString()} · {sale.customerName || "Customer"} · {sale.lines.length} item{sale.lines.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-foreground-heading">{formatPaise(sale.totalPaise)}</p>
                <StatusBadge status={STATUS_LABEL[sale.syncState]} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
