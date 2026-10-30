"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, CalendarDays, Loader2, Package, Plus } from "lucide-react";
import Link from "next/link";
import { inventoryApi, productsApi, stockApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { InventoryBalanceDTO, OfflineStockAdjustmentDTO } from "@/shared/lib/api/inventory";
import { cardCls, EmptyState, inputCls, primaryBtnCls, SkeletonRows } from "@/shared/components/ui";
import { formatProductUnitCount, formatProductUnitEquivalence, toBaseQuantity, type BaseUnit, type SaleUnit } from "@/shared/lib/units";

interface OnHand {
  productId: string;
  name: string;
  saleUnit: SaleUnit;
  baseUnit: BaseUnit;
  basePerSaleUnit: number;
  availableBase: number;
  expiry?: string;
}

export default function StockPage() {
  const PAGE_SIZE = 10;
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [balances, setBalances] = useState<InventoryBalanceDTO[]>([]);
  const [adjustments, setAdjustments] = useState<OfflineStockAdjustmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [stockPage, setStockPage] = useState(1);
  const [reviewAdjustment, setReviewAdjustment] = useState<OfflineStockAdjustmentDTO | null>(null);
  const [resolvingAdjustment, setResolvingAdjustment] = useState(false);

  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");

  const load = useCallback(async () => {
    const [p, b, a] = await Promise.all([productsApi.list({ limit: 100 }), inventoryApi.list(), inventoryApi.offlineAdjustments()]);
    if (p.success && p.data) {
      setProducts(p.data.items);
      setSkuId((cur) => cur || p.data!.items[0]?._id || "");
    }
    if (b.success && b.data) setBalances(b.data.items);
    if (a.success && a.data) setAdjustments(a.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const updateOnline = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const selected = products.find((p) => p._id === skuId);
  const pendingAdjustments = adjustments.filter((adjustment) => adjustment.status === "pending_review");

  const onHand = useMemo<OnHand[]>(() => {
    const byProduct = new Map<string, OnHand>();
    for (const b of balances) {
      const key = b.productId;
      const prev = byProduct.get(key);
      const row: OnHand = prev ?? {
        productId: key,
        name: b.productName ?? key,
        saleUnit: (b.saleUnit as SaleUnit) ?? "piece",
        baseUnit: b.baseUnit ?? products.find((product) => product._id === key)?.baseUnit ?? "count",
        basePerSaleUnit: products.find((product) => product._id === key)?.basePerSaleUnit ?? 1,
        availableBase: 0,
        expiry: undefined,
      };
      row.availableBase += b.availableBase;
      if (b.expiryDate && (!row.expiry || b.expiryDate < row.expiry)) row.expiry = b.expiryDate;
      byProduct.set(key, row);
    }
    return [...byProduct.values()].sort((a, b) => a.availableBase - b.availableBase);
  }, [balances, products]);
  const stockPages = Math.max(1, Math.ceil(onHand.length / PAGE_SIZE));
  const visibleStock = onHand.slice((stockPage - 1) * PAGE_SIZE, stockPage * PAGE_SIZE);
  useEffect(() => { setStockPage((current) => Math.min(current, stockPages)); }, [stockPages]);

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !skuId || !qty.trim()) return;
    if (!online) {
      toast.error("Connect to the internet to update stock. Offline stock changes are disabled.");
      return;
    }
    setBusy(true);
    const res = await stockApi.add({
      skuId,
      quantity: qty.trim(),
      expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    if (res.data && selected) {
      const addedBase = toBaseQuantity(Number(qty.trim()), selected.saleUnit, selected.basePerSaleUnit);
      setBalances((current) => {
        const next: InventoryBalanceDTO = {
          _id: `${selected._id}:${res.data!.lotId}`,
          productId: selected._id,
          productName: selected.name,
          lotId: res.data!.lotId,
          lotCode: res.data!.lotCode,
          saleUnit: selected.saleUnit,
          availableBase: addedBase,
          expiryDate: res.data!.expiresAt ?? undefined,
        };
        return [...current, next];
      });
    }
    toast.success(`Added ${qty.trim()} units to stock`);
    setQty("");
    setExpiry("");
    await load();
  }

  async function confirmAdjustment(adjustment: OfflineStockAdjustmentDTO) {
    if (resolvingAdjustment) return;
    setResolvingAdjustment(true);
    const res = await inventoryApi.resolveOfflineAdjustment(adjustment.id, "Confirmed by seller during offline stock reconciliation.");
    setResolvingAdjustment(false);
    if (!res.success || !res.data?.item) {
      toast.error(res.message);
      return;
    }
    const item = res.data.item;
    setAdjustments((current) => current.map((entry) => entry.id === adjustment.id ? { ...entry, ...item } : entry));
    setReviewAdjustment(null);
    toast.success("Extra units confirmed and added to adjusted stock details.");
  }

  if (loading) return <SkeletonRows rows={5} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Inventory</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground-heading">Stock</h1>
            <p className="mt-1 text-sm text-foreground-muted">Keep your available quantities and expiry dates up to date.</p>
          </div>
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-foreground-muted">{onHand.length} stocked products</span>
        </div>
      </header>

      {!online ? (
        <p role="status" className="rounded-xl border border-status-warning/40 bg-status-warning-surface p-3 text-sm text-status-warning">
          Stock updates are unavailable offline. Reconnect before receiving a new batch.
        </p>
      ) : null}

      {pendingAdjustments.length > 0 ? (
        <section className={`${cardCls} border-status-warning/40 bg-status-warning-surface p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground-heading">Offline stock adjustments</h2>
              <p className="mt-1 text-sm text-foreground-muted">These sales were recorded offline above the server stock known at sync time and need review.</p>
            </div>
            <span className="rounded-full bg-status-warning-surface px-3 py-1 text-xs font-semibold text-status-warning">{pendingAdjustments.length} pending</span>
          </div>
          <div className="mt-4 grid gap-2">
            {pendingAdjustments.slice(0, 5).map((adjustment) => (
              <div key={adjustment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card px-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground-heading">{adjustment.productName ?? adjustment.skuId}</p>
                    <p className="text-foreground-muted">Extra sold {formatAdjustmentQuantity(adjustment.shortfallQuantity, adjustment.unit, adjustment.basePerSaleUnit, adjustment.baseUnit)} · {new Date(adjustment.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewAdjustment(adjustment)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                >
                  Review adjustment
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {reviewAdjustment ? (
        <section className={`${cardCls} border-primary/30 bg-surface-card p-5 shadow-sm`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Stock reconciliation</p>
              <h2 className="mt-1 text-lg font-bold text-foreground-heading">Review extra units</h2>
              <p className="mt-1 text-sm text-foreground-muted">The offline sale used more stock than the server had recorded. Confirming this records the extra units in the adjusted stock audit trail.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-foreground-muted" disabled={resolvingAdjustment} onClick={() => setReviewAdjustment(null)}>Close</button>
          </div>
          <dl className="mt-4 grid gap-3 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2">
            <AdjustmentDetail label="Product" value={reviewAdjustment.productName ?? reviewAdjustment.skuId} />
            <AdjustmentDetail label="Extra units sold" value={formatAdjustmentQuantity(reviewAdjustment.shortfallQuantity, reviewAdjustment.unit, reviewAdjustment.basePerSaleUnit, reviewAdjustment.baseUnit)} />
            <AdjustmentDetail label="Server stock before sale" value={formatAdjustmentQuantity(reviewAdjustment.serverQuantityBefore, reviewAdjustment.unit, reviewAdjustment.basePerSaleUnit, reviewAdjustment.baseUnit)} />
            <AdjustmentDetail label="Requested offline" value={formatAdjustmentQuantity(reviewAdjustment.requestedQuantity, reviewAdjustment.unit, reviewAdjustment.basePerSaleUnit, reviewAdjustment.baseUnit)} />
            <AdjustmentDetail label="Allocated from server" value={formatAdjustmentQuantity(reviewAdjustment.allocatedQuantity, reviewAdjustment.unit, reviewAdjustment.basePerSaleUnit, reviewAdjustment.baseUnit)} />
            <AdjustmentDetail label="Receipt" value={reviewAdjustment.saleId} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryBtnCls}
              disabled={resolvingAdjustment}
              onClick={() => void confirmAdjustment(reviewAdjustment)}
            >
              {resolvingAdjustment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm extra units
            </button>
            <Link href={`/pos/history/${reviewAdjustment.saleId}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground-body">
              View receipt
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <section className={`${cardCls} bg-surface-card p-5 shadow-sm`}>
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="h-5 w-5" /></div>
          <div><h2 className="text-base font-bold text-foreground-heading">Add stock</h2><p className="mt-1 text-xs text-foreground-muted">Record a new incoming batch.</p></div>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-foreground-muted">Add a product first.</p>
        ) : (
          <form onSubmit={addStock} className="grid gap-4">
            <div>
              <Label>Product</Label>
              <select
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                className={inputCls}
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantity (units)</Label>
              <input
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inputCls}
              />
              {selected ? <p className="mt-1 text-xs text-foreground-muted">{formatProductUnitEquivalence(selected.baseUnit ?? "count", selected.basePerSaleUnit)}</p> : null}
            </div>
            <div>
              <Label>Expires on (optional)</Label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="pt-1">
              <button type="submit" disabled={!online || busy} className={`${primaryBtnCls} w-full`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {online ? "Add stock" : "Connect to add stock"}
              </button>
              <p className="mt-2 text-xs text-foreground-muted">{online ? "This adds to available stock." : "Reconnect to add stock; offline stock receipts are disabled."}</p>
            </div>
          </form>
        )}
      </section>

      <section className={`${cardCls} bg-surface-card p-5 shadow-sm`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-base font-bold text-foreground-heading">Available stock</h2><p className="mt-1 text-xs text-foreground-muted">Current sellable quantity by product.</p></div>
          <Package className="h-5 w-5 text-foreground-muted" />
        </div>
        {onHand.length === 0 ? (
          <EmptyState title="No stock yet" description="Add stock above to start selling." />
        ) : (
          <>
          <ul className="space-y-2 text-sm">
            {visibleStock.map((r) => (
              <li key={r.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem]">
                <div className="min-w-0"><p className="truncate font-semibold text-foreground-heading">{r.name}</p><p className="mt-0.5 text-xs text-foreground-muted">{formatProductUnitEquivalence(r.baseUnit, r.basePerSaleUnit)}</p></div>
                <span className="text-right text-base font-bold text-primary">{formatProductUnitCount(r.availableBase, r.basePerSaleUnit)}</span>
                <span className="col-span-2 flex items-center gap-1.5 text-xs text-foreground-muted sm:col-span-1 sm:justify-end"><CalendarDays className="h-3.5 w-3.5" />{r.expiry ? `Expires ${new Date(r.expiry).toLocaleDateString("en-IN")}` : "No expiry"}</span>
              </li>
            ))}
          </ul>
          {stockPages > 1 ? <Pagination page={stockPage} pages={stockPages} onPageChange={setStockPage} /> : null}
          </>
        )}
      </section>
    </div>

      <section className={`${cardCls} bg-surface-card p-5 shadow-sm`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Inventory audit</p>
          <h2 className="mt-1 text-lg font-bold text-foreground-heading">Adjusted stock details</h2>
          <p className="mt-1 text-sm text-foreground-muted">Every offline stock shortfall is listed here with its server allocation and review status.</p>
        </div>
        {adjustments.length === 0 ? (
          <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-foreground-muted">No adjusted stock records yet.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {adjustments.slice(0, 10).map((adjustment) => (
              <div key={adjustment.id} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground-heading">{adjustment.productName ?? adjustment.skuId}</p>
                    <p className="text-foreground-muted">Extra sold {formatAdjustmentQuantity(adjustment.shortfallQuantity, adjustment.unit, adjustment.basePerSaleUnit)} · {new Date(adjustment.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${adjustment.status === "pending_review" ? "bg-status-warning-surface text-status-warning" : "bg-status-success-surface text-status-success"}`}>{adjustment.status.replaceAll("_", " ")}</span>
                    {adjustment.status === "pending_review" ? (
                      <button type="button" className="text-xs font-semibold text-primary" onClick={() => setReviewAdjustment(adjustment)}>Review</button>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 border-t border-border/70 pt-3 text-xs sm:grid-cols-4">
                  <AdjustmentDetail label="Server before" value={formatAdjustmentQuantity(adjustment.serverQuantityBefore, adjustment.unit, adjustment.basePerSaleUnit, adjustment.baseUnit)} />
                  <AdjustmentDetail label="Requested" value={formatAdjustmentQuantity(adjustment.requestedQuantity, adjustment.unit, adjustment.basePerSaleUnit, adjustment.baseUnit)} />
                  <AdjustmentDetail label="Allocated" value={formatAdjustmentQuantity(adjustment.allocatedQuantity, adjustment.unit, adjustment.basePerSaleUnit, adjustment.baseUnit)} />
                  <AdjustmentDetail label={adjustment.reviewedAt ? "Reviewed" : "Created"} value={new Date(adjustment.reviewedAt ?? adjustment.createdAt).toLocaleString()} />
                </dl>
                {adjustment.resolutionNote ? <p className="mt-2 text-xs text-foreground-muted">Note: {adjustment.resolutionNote}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Pagination({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (page: number) => void }) {
  return <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
    <button type="button" className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
    <span className="text-foreground-muted">Page {page} of {pages}</span>
    <button type="button" className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-foreground-body">{children}</label>;
}

function formatAdjustmentQuantity(value: string | number, _unit?: string, basePerSaleUnit = 1, _baseUnit?: BaseUnit): string {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return String(value);
  return formatProductUnitCount(quantity, basePerSaleUnit);
}

function AdjustmentDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-foreground-muted">{label}</dt><dd className="mt-1 font-semibold text-foreground-heading">{value}</dd></div>;
}
