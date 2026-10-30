"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanBarcode, TrendingUp, Wallet } from "lucide-react";
import { registersApi, salesApi } from "@/shared/lib/api";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { DailySalesTotal, SaleDTO } from "@/shared/lib/api/sales";
import { usePosUser } from "@/shared/context/PosUserContext";
import { primaryBtnCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import {
  listOfflineSales,
  type OfflineSaleRecord,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
import {
  mergeSalesWithOffline,
  pendingOfflineCashTotal,
} from "@/shared/lib/offline/session-summary";
import { KomoEmptyState } from "@/shared/components/mascot";

export default function DashboardPage() {
  const { user } = usePosUser();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRecord[]>([]);
  const [daily, setDaily] = useState<DailySalesTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user)
      return () => {
        alive = false;
      };

    const load = async () => {
      const scope: OfflineScope = {
        userId: user.id,
        orgId: user.orgId,
        locationId: user.locationId,
      };
      const [ov, sl, dl, local] = await Promise.all([
        registersApi.overview(),
        salesApi.list({ limit: 5 }),
        salesApi.daily(6),
        listOfflineSales(scope),
      ]);
      if (!alive) return;
      if (ov.success && ov.data) setSession(ov.data.currentSession);
      if (sl.success && sl.data) setSales(sl.data.items);
      if (dl.success && dl.data) setDaily(dl.data);
      setOfflineSales(local);
      setLoading(false);
    };
    void load();
    const onOfflineSalesChanged = () => void load();
    window.addEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    return () => {
      alive = false;
      window.removeEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    };
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const recentSales = useMemo(
    () => mergeSalesWithOffline(sales, offlineSales, today, 5),
    [offlineSales, sales, today],
  );
  const { amountPaise: offlineCashPaise, count: offlineSaleCount } = useMemo(
    () => pendingOfflineCashTotal(offlineSales),
    [offlineSales],
  );
  const offlineAttentionCount = offlineSales.filter(
    (sale) =>
      sale.syncState === "blocked" ||
      sale.syncState === "needs_review" ||
      sale.syncState === "auth_required",
  ).length;

  const t = session?.totals;
  const serverSalesToday = t ? t.cashSalesPaise + t.upiSalesPaise + t.cardSalesPaise : 0;
  const salesToday = serverSalesToday + offlineCashPaise;

  const drawerExpected = session
    ? session.openingCashPaise +
      (t?.cashSalesPaise ?? 0) +
      offlineCashPaise -
      (t?.refundsPaise ?? 0)
    : null;
  const needsAttention = offlineAttentionCount > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">
            Good day{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {session ? "Register is open" : "No open register session"}
          </p>
        </div>
        <Link
          href="/offline-operations"
          className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold ${
            needsAttention
              ? "bg-status-warning-surface text-status-warning"
              : "bg-status-success-surface text-status-success"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {needsAttention
            ? `${offlineAttentionCount} needs attention`
            : offlineSaleCount > 0
              ? `${offlineSaleCount} pending sync`
              : "Synced"}
        </Link>
      </header>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <section className="rounded-3xl bg-surface-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
              Sales this session
            </p>
            <p className="mt-2 text-5xl font-bold tracking-[-0.03em] text-foreground-heading">
              {formatPaise(salesToday)}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              {(t?.saleCount ?? 0) + offlineSaleCount} sale
              {(t?.saleCount ?? 0) + offlineSaleCount === 1 ? "" : "s"}
            </p>
            <Link href="/pos" className={`${primaryBtnCls} mt-5 w-full sm:w-auto`}>
              <ScanBarcode className="h-5 w-5" />
              New sale
            </Link>
          </section>

          {daily.length > 0 ? <DailyBars days={daily} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/register-sessions"
              className="rounded-3xl bg-surface-card p-5 transition hover:bg-surface-muted"
            >
              <div className="flex items-center gap-2 text-foreground-muted">
                <Wallet className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Cash in drawer
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground-heading">
                {drawerExpected === null ? "—" : formatPaise(drawerExpected)}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                Expected · opening cash plus cash sales
              </p>
            </Link>
            <Link
              href="/offline-operations"
              className="rounded-3xl bg-surface-card p-5 transition hover:bg-surface-muted"
            >
              <div className="flex items-center gap-2 text-foreground-muted">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Offline sales
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground-heading">
                {offlineSaleCount} pending
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                Saved on this device and synced automatically
              </p>
            </Link>
          </div>

          <section className="rounded-3xl bg-surface-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                Recent sales
              </h2>
              <Link href="/pos/history" className="text-sm font-semibold text-primary">
                View all
              </Link>
            </div>
            {recentSales.length === 0 ? (
              <KomoEmptyState
                action="idle"
                title="Your sales will appear here."
                description="Complete your first sale from the POS to start building your history."
                buttonLabel="Open POS"
                buttonHref="/pos"
              />
            ) : (
              <ul>
                {recentSales.map(({ sale: s, local, state, serverSaleId }) => (
                  <li key={`${local ? "local" : "server"}:${s._id}`}>
                    <Link
                      href={
                        local && !serverSaleId
                          ? "/offline-operations"
                          : `/pos/history/${serverSaleId ?? s._id}`
                      }
                      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-heading">
                          {s.receiptNo}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {new Date(s.soldAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {local
                            ? ` · ${offlineSales.find((sale) => sale.operationId === s.idempotencyKey)?.syncMessage ?? "offline sale"}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={local ? state : s.status} />
                      <span className="w-24 text-right text-sm font-bold text-foreground-heading">
                        {formatPaise(s.totalPaise)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DailyBars({ days }: { days: DailySalesTotal[] }) {
  const max = Math.max(1, ...days.map((d) => d.totalPaise));
  const total = days.reduce((sum, d) => sum + d.totalPaise, 0);
  const weekday = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
  return (
    <section className="rounded-3xl bg-surface-card p-5" aria-label="Sales for the last six days">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
          Last {days.length} days
        </h2>
        <p className="text-sm font-bold text-foreground-heading">{formatPaise(total)}</p>
      </div>
      <ul className="mt-4 grid h-36 grid-cols-6 items-end gap-3">
        {days.map((d, i) => {
          const today = i === days.length - 1;
          return (
            <li
              key={d.date}
              className="flex h-full flex-col items-center justify-end gap-2"
              title={`${d.date}: ${formatPaise(d.totalPaise)} from ${d.completedCount} sale${d.completedCount === 1 ? "" : "s"}`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-xl ${today ? "bg-primary" : "bg-tertiary"}`}
                  style={{ height: `${Math.max(4, (d.totalPaise / max) * 100)}%` }}
                />
              </div>
              <span
                className={`text-[11px] font-semibold ${today ? "text-foreground-heading" : "text-foreground-muted"}`}
              >
                {today ? "Today" : weekday(d.date)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
