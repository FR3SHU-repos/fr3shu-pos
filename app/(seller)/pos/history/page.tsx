"use client";

import { Pagination } from "@/shared/components/Pagination";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { salesApi } from "@/shared/lib/api";
import { usePosUser } from "@/shared/context/PosUserContext";
import type { SaleDTO } from "@/shared/lib/api/sales";
import {
  combineSummary,
  inBounds,
  normalizePhoneSearch,
  periodBounds,
  PERIODS,
  type Period,
} from "@/shared/lib/pos/sales-period";
import { useApi } from "@/shared/hooks/useApi";
import {
  EmptyState,
  ErrorState,
  inputCls,
  SkeletonRows,
  StatusBadge,
} from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import {
  listOfflineSales,
  type OfflineSaleRecord,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
import {
  activeOfflineCashSales,
  mergeSalesWithOffline,
} from "@/shared/lib/offline/session-summary";

export default function SalesHistoryPage() {
  const PAGE_SIZE = 10;
  const { user } = usePosUser();
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRecord[]>([]);
  const [receiptNo, setReceiptNo] = useState("");
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>("today");

  // Server page for the current filters. Debounced for the search boxes; a late
  // response for an older filter is discarded by useApi.
  const {
    data: list,
    error: listError,
    loading,
    refetch,
  } = useApi(
    () =>
      salesApi.list({
        page,
        limit: PAGE_SIZE,
        receiptNo: receiptNo.trim() || undefined,
        phone: normalizePhoneSearch(phone) || undefined,
        ...periodBounds(period),
      }),
    [page, receiptNo, phone, period],
    { debounceMs: 250 },
  );
  const items = useMemo<SaleDTO[]>(() => list?.items ?? [], [list]);
  const totalPages = Math.max(1, list?.meta.totalPages ?? 1);
  const summary = list?.summary ?? null;

  // Unsynced sales stored on this device; refreshed when the sync worker reports a change.
  useEffect(() => {
    let alive = true;
    const scope: OfflineScope | null = user
      ? { userId: user.id, orgId: user.orgId, locationId: user.locationId }
      : null;
    const loadLocal = async () => {
      const local = scope ? await listOfflineSales(scope) : [];
      if (alive) setOfflineSales(local);
    };
    void loadLocal();
    const onOfflineSalesChanged = () => {
      void loadLocal();
      void refetch();
    };
    window.addEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    return () => {
      alive = false;
      window.removeEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    };
  }, [user, refetch]);

  useEffect(() => {
    setPage(1);
  }, [receiptNo, phone, period]);

  const visibleItems = useMemo(() => {
    const receiptQuery = receiptNo.trim().toLowerCase();
    const phoneQuery = normalizePhoneSearch(phone);
    const filteredOffline = offlineSales
      .filter(
        (sale) =>
          !receiptQuery ||
          sale.receiptNo.toLowerCase().includes(receiptQuery) ||
          sale.serverReceiptNo?.toLowerCase().includes(receiptQuery),
      )
      .filter(
        (sale) => !phoneQuery || normalizePhoneSearch(sale.customerPhone ?? "") === phoneQuery,
      )
      .filter((sale) => inBounds(sale.soldAt ?? sale.createdAt ?? 0, periodBounds(period)));
    return mergeSalesWithOffline(
      items,
      filteredOffline,
      new Date().toISOString().slice(0, 10),
    ).slice(0, PAGE_SIZE);
  }, [items, offlineSales, phone, receiptNo, period]);

  // Unsynced offline sales in the selected period. They are not in the server
  // total yet, so they are shown as a separate, clearly labelled addition.
  const pendingOffline = useMemo(() => {
    const bounds = periodBounds(period);
    const inPeriod = activeOfflineCashSales(offlineSales).filter((sale) =>
      inBounds(sale.soldAt ?? sale.createdAt ?? 0, bounds),
    );
    return {
      count: inPeriod.length,
      totalPaise: inPeriod.reduce((sum, sale) => sum + sale.totalPaise, 0),
    };
  }, [offlineSales, period]);

  const combined = combineSummary(summary, pendingOffline);

  const groups = useMemo(() => {
    const labelFor = (iso: string) => {
      const d = new Date(iso);
      const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
      return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    };
    const out: { label: string; rows: typeof visibleItems }[] = [];
    for (const row of visibleItems) {
      const label = labelFor(row.sale.soldAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [visibleItems]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">Sales</h1>

      <div role="tablist" aria-label="Period" className="flex gap-2 overflow-x-auto scrollbar-hide">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition ${
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-foreground-body hover:text-foreground-heading"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {combined.hasData ? (
        <div className="rounded-3xl bg-surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
            {PERIODS.find((p) => p.key === period)?.label} · completed sales
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground-heading">
            {formatPaise(combined.totalPaise)}
          </p>
          <p className="text-sm text-foreground-muted">
            {combined.completedCount} sale{combined.completedCount === 1 ? "" : "s"}
          </p>
          {pendingOffline.count > 0 ? (
            <p className="mt-3 inline-flex rounded-full bg-status-warning-surface px-3 py-1 text-xs font-semibold text-status-warning">
              Includes {formatPaise(pendingOffline.totalPaise)} from {pendingOffline.count} offline
              sale{pendingOffline.count === 1 ? "" : "s"} waiting to sync
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="Receipt number"
            className={`${inputCls} rounded-full pl-10`}
          />
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="Customer phone (10 digits)"
          inputMode="numeric"
          maxLength={10}
          className={`${inputCls} rounded-full`}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : listError && visibleItems.length === 0 ? (
        <ErrorState
          title="Could not load sales"
          message={listError}
          onRetry={() => void refetch()}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No sales found"
          description="Completed and locally saved offline sales will appear here."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                {group.label}
              </h2>
              <ul className="overflow-hidden rounded-3xl bg-surface-card p-1.5">
                {group.rows.map(({ sale: s, local, state, serverSaleId, serverReceiptNo }) => {
                  const href =
                    local && !serverSaleId ? null : `/pos/history/${serverSaleId ?? s._id}`;
                  const itemCount = s.items.length;
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground-heading">
                          {s.receiptNo}
                        </p>
                        <p className="truncate text-xs text-foreground-muted">
                          {new Date(s.soldAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
                          {local
                            ? ` · ${serverReceiptNo ? `Server receipt ${serverReceiptNo}` : (offlineSales.find((sale) => sale.operationId === s.idempotencyKey)?.syncMessage ?? "offline sale")}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={local ? state : s.status} />
                      <span className="w-24 text-right text-sm font-bold text-foreground-heading">
                        {formatPaise(s.totalPaise)}
                      </span>
                    </>
                  );
                  return (
                    <li key={`${local ? "local" : "server"}:${s._id}`}>
                      {href ? (
                        <Link
                          href={href}
                          className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface-muted"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex min-h-16 items-center gap-3 px-3 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Pagination
            page={page}
            pages={totalPages}
            onPageChange={setPage}
            disabled={loading}
            label="Sales pages"
          />
        </div>
      )}
    </div>
  );
}
