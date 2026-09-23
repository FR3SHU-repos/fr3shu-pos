"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanBarcode, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { registersApi, salesApi } from "@/shared/lib/api";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, primaryBtnCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { listOfflineSales, type OfflineSaleRecord, type OfflineScope } from "@/shared/lib/offline/sales";
import { mergeSalesWithOffline, pendingOfflineCashTotal } from "@/shared/lib/offline/session-summary";
import { KomoEmptyState, KomoMessage } from "@/shared/components/mascot";

export default function DashboardPage() {
  const { user } = usePosUser();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const scope: OfflineScope | null = user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null;
      const [ov, sl, local] = await Promise.all([
        registersApi.overview(),
        salesApi.list({ limit: 5 }),
        scope ? listOfflineSales(scope) : Promise.resolve([]),
      ]);
      if (!alive) return;
      if (ov.success && ov.data) setSession(ov.data.currentSession);
      if (sl.success && sl.data) setSales(sl.data.items);
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
  const recentSales = useMemo(() => mergeSalesWithOffline(sales, offlineSales, today, 5), [offlineSales, sales, today]);
  const { amountPaise: offlineCashPaise, count: offlineSaleCount } = useMemo(() => pendingOfflineCashTotal(offlineSales), [offlineSales]);

  const t = session?.totals;
  const serverSalesToday = t ? t.cashSalesPaise + t.upiSalesPaise + t.cardSalesPaise : 0;
  const salesToday = serverSalesToday + offlineCashPaise;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground-heading">
            Good day{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-foreground-muted">
            {session ? "Register session is open" : "No open register session"}
          </p>
        </div>
        <Link href="/pos" className={primaryBtnCls}>
          <ScanBarcode className="h-4 w-4" />
          Open POS
        </Link>
      </header>

      <KomoMessage action="wave" title="Ready for your first sale?" description="Komo is here to help you keep the counter moving." compact />

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Sales this session"
              value={formatPaise(salesToday)}
            />
            <StatCard
              icon={<ReceiptText className="h-5 w-5" />}
              label="Sale count"
              value={String((t?.saleCount ?? 0) + offlineSaleCount)}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Cash in drawer (expected)"
              value={
                session
                  ? formatPaise(
                      session.openingCashPaise +
                        (t?.cashSalesPaise ?? 0) +
                        offlineCashPaise -
                        (t?.refundsPaise ?? 0),
                    )
                  : "—"
              }
            />
          </div>

          <section className={cardCls}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground-heading">Recent sales</h2>
              <Link href="/pos/history" className="text-xs font-medium text-brand">
                View all
              </Link>
            </div>
            {recentSales.length === 0 ? (
              <KomoEmptyState action="idle" title="Your sales will appear here." description="Complete your first sale from the POS to start building your history." buttonLabel="Open POS" buttonHref="/pos" />
            ) : (
              <ul className="divide-y divide-border">
                {recentSales.map(({ sale: s, local, state, serverSaleId }) => (
                  <li key={`${local ? "local" : "server"}:${s._id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      {local && !serverSaleId ? (
                        <span className="font-medium text-foreground-heading">{s.receiptNo}</span>
                      ) : (
                        <Link href={`/pos/history/${serverSaleId ?? s._id}`} className="font-medium text-brand">
                          {s.receiptNo}
                        </Link>
                      )}
                      {local ? <p className="text-xs text-foreground-muted">local offline sale</p> : null}
                    </div>
                    <span className="text-foreground-muted">
                      {new Date(s.soldAt).toLocaleTimeString("en-IN")}
                    </span>
                    <StatusBadge status={local ? state : s.status} />
                    <span className="font-semibold text-foreground-heading">
                      {formatPaise(s.totalPaise)}
                    </span>
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 text-foreground-muted">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground-heading">{value}</p>
    </div>
  );
}
