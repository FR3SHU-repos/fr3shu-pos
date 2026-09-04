"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ScanBarcode, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { registersApi, salesApi } from "@/shared/lib/api";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, primaryBtnCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";

export default function DashboardPage() {
  const { user } = usePosUser();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ov, sl] = await Promise.all([
        registersApi.overview(),
        salesApi.list({ limit: 5 }),
      ]);
      if (!alive) return;
      if (ov.success && ov.data) setSession(ov.data.currentSession);
      if (sl.success && sl.data) setSales(sl.data.items);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const t = session?.totals;
  const salesToday = t ? t.cashSalesPaise + t.upiSalesPaise + t.cardSalesPaise : 0;

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
              value={String(t?.saleCount ?? 0)}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Cash in drawer (expected)"
              value={
                session
                  ? formatPaise(
                      session.openingCashPaise +
                        (t?.cashSalesPaise ?? 0) -
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
            {sales.length === 0 ? (
              <p className="py-6 text-center text-sm text-foreground-muted">No sales yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {sales.map((s) => (
                  <li key={s._id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/pos/history/${s._id}`} className="font-medium text-brand">
                      {s.receiptNo}
                    </Link>
                    <span className="text-foreground-muted">
                      {new Date(s.soldAt).toLocaleTimeString("en-IN")}
                    </span>
                    <StatusBadge status={s.status} />
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
