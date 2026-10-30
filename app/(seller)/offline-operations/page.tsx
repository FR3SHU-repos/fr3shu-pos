"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CloudOff,
  Database,
  Package,
  ReceiptText,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, ghostBtnCls } from "@/shared/components/ui";
import { OfflineCatalogue } from "@/shared/components/products/OfflineCatalogue";
import { OfflineReadinessPanel } from "@/shared/components/pos/OfflineReadinessPanel";
import { OfflineSalesPanel } from "@/shared/components/pos/OfflineSalesPanel";
import { PwaInstallPrompt } from "@/shared/components/PwaInstallPrompt";
import {
  listOfflineSales,
  type OfflineScope,
  type OfflineSaleRecord,
} from "@/shared/lib/offline/sales";
import { offlineMutationSummary } from "@/shared/lib/offline/mutations";
import { readProducts, setProductScope, type ProductSnapshot } from "@/shared/lib/offline/products";

export default function OfflineOperationsPage() {
  const { user } = usePosUser();
  const [sales, setSales] = useState<OfflineSaleRecord[]>([]);
  const [snapshot, setSnapshot] = useState<ProductSnapshot | null>(null);
  const [mutationCounts, setMutationCounts] = useState({ pending: 0, blocked: 0 });
  const [online, setOnline] = useState(true);

  const scope = useMemo<OfflineScope | null>(() => {
    if (!user) return null;
    return { userId: user.id, orgId: user.orgId, locationId: user.locationId };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!scope) return;
    setProductScope(user);
    const [nextSales, nextSnapshot, nextMutations] = await Promise.all([
      listOfflineSales(scope),
      readProducts(),
      offlineMutationSummary(scope),
    ]);
    setSales(nextSales);
    setSnapshot(nextSnapshot);
    setMutationCounts(nextMutations);
  }, [scope, user]);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" || navigator.onLine);
    void refresh();
    const onConnection = () => setOnline(navigator.onLine);
    const onChange = () => void refresh();
    window.addEventListener("online", onConnection);
    window.addEventListener("offline", onConnection);
    window.addEventListener("komola:offline-sales-changed", onChange);
    window.addEventListener("komola:offline-mutations-changed", onChange);
    return () => {
      window.removeEventListener("online", onConnection);
      window.removeEventListener("offline", onConnection);
      window.removeEventListener("komola:offline-sales-changed", onChange);
      window.removeEventListener("komola:offline-mutations-changed", onChange);
    };
  }, [refresh]);

  const activeSales = sales.filter(
    (sale) => sale.syncState !== "synced" && sale.syncState !== "cancelled",
  );
  const waitingSales = activeSales.filter(
    (sale) => sale.syncState === "pending" || sale.syncState === "uploading",
  );
  const reviewSales = activeSales.filter(
    (sale) =>
      sale.syncState === "blocked" ||
      sale.syncState === "needs_review" ||
      sale.syncState === "auth_required",
  );
  const deviceChanges = mutationCounts.pending + mutationCounts.blocked;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-foreground-body"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Today
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            Device operations
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-foreground-heading">
            Offline operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Keep selling during a connection problem, then review what is waiting for the server
            when you are back online.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-2 text-sm font-semibold text-foreground-body">
          {online ? (
            <Wifi className="h-4 w-4 text-status-success" />
          ) : (
            <CloudOff className="h-4 w-4 text-status-warning" />
          )}
          {online ? "Online" : "Offline"}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Pending sales"
          value={String(activeSales.length)}
          detail={`${waitingSales.length} waiting to sync`}
        />
        <MetricCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Needs attention"
          value={String(reviewSales.length)}
          detail="Open a sale for the exact reason"
          tone={reviewSales.length > 0 ? "warning" : "default"}
        />
        <MetricCard
          icon={<Package className="h-5 w-5" />}
          label="Saved products"
          value={snapshot ? String(snapshot.items.length) : "—"}
          detail="Available on this device"
        />
        <MetricCard
          icon={<Database className="h-5 w-5" />}
          label="Offline changes"
          value={String(deviceChanges)}
          detail={`${mutationCounts.pending} waiting · ${mutationCounts.blocked} blocked`}
          tone={mutationCounts.blocked > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start">
        <OfflineReadinessPanel />
        <section className={`${cardCls} h-full`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            What happens next
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground-heading">
            The seller keeps working
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-foreground-muted">
            <Step
              number="1"
              text="Cash sales, products, and stock changes are saved on this device."
            />
            <Step number="2" text="When the connection returns, KOMOLA syncs them automatically." />
            <Step number="3" text="Only conflicts or incompatible records need your attention." />
          </ol>
        </section>
      </div>

      <div id="pending-sales" className="scroll-mt-24">
        <OfflineSalesPanel fullPage />
      </div>

      <section className={`${cardCls} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Local data
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-foreground-heading">
              Saved catalogue and stock
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
              Browse the product copy used for offline selling, or open the normal product and stock
              screens to make changes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className={ghostBtnCls}>
              Products
            </Link>
            <Link href="/stock" className={ghostBtnCls}>
              Stock
            </Link>
          </div>
        </div>
        <OfflineCatalogue />
      </section>

      <PwaInstallPrompt />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 text-foreground-muted">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p
        className={`mt-3 text-2xl font-black tracking-[-0.04em] ${tone === "warning" ? "text-status-warning" : "text-foreground-heading"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{detail}</p>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </span>
      <span>{text}</span>
    </li>
  );
}
