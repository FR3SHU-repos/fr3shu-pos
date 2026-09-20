"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Loader2, Package, Plus } from "lucide-react";
import { inventoryApi, productsApi, stockApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { InventoryBalanceDTO } from "@/shared/lib/api/inventory";
import { cardCls, EmptyState, inputCls, primaryBtnCls, SkeletonRows } from "@/shared/components/ui";
import { formatBaseQuantity, toBaseQuantity, type SaleUnit } from "@/shared/lib/units";

interface OnHand {
  productId: string;
  name: string;
  saleUnit: SaleUnit;
  availableBase: number;
  expiry?: string;
}

export default function StockPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [balances, setBalances] = useState<InventoryBalanceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([productsApi.list({ limit: 100 }), inventoryApi.list()]);
    if (p.success && p.data) {
      setProducts(p.data.items);
      setSkuId((cur) => cur || p.data!.items[0]?._id || "");
    }
    if (b.success && b.data) setBalances(b.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = products.find((p) => p._id === skuId);

  const onHand = useMemo<OnHand[]>(() => {
    const byProduct = new Map<string, OnHand>();
    for (const b of balances) {
      const key = b.productId;
      const prev = byProduct.get(key);
      const row: OnHand = prev ?? {
        productId: key,
        name: b.productName ?? key,
        saleUnit: (b.saleUnit as SaleUnit) ?? "piece",
        availableBase: 0,
        expiry: undefined,
      };
      row.availableBase += b.availableBase;
      if (b.expiryDate && (!row.expiry || b.expiryDate < row.expiry)) row.expiry = b.expiryDate;
      byProduct.set(key, row);
    }
    return [...byProduct.values()].sort((a, b) => a.availableBase - b.availableBase);
  }, [balances]);

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !skuId || !qty.trim()) return;
    setBusy(true);
    const res = await stockApi.add({
      skuId,
      quantity: qty.trim(),
      expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    if (res.data && selected) {
      const addedBase = toBaseQuantity(Number(qty.trim()), selected.saleUnit);
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
    toast.success(`Added ${qty.trim()} ${selected?.saleUnit ?? ""} to stock`);
    setQty("");
    setExpiry("");
    await load();
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

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <section className={`${cardCls} bg-white p-5 shadow-sm`}>
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
              <Label>Quantity{selected ? ` (${selected.saleUnit})` : ""}</Label>
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
              <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add stock
              </button>
              <p className="mt-2 text-xs text-foreground-muted">This adds to available stock.</p>
            </div>
          </form>
        )}
      </section>

      <section className={`${cardCls} bg-white p-5 shadow-sm`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-base font-bold text-foreground-heading">Available stock</h2><p className="mt-1 text-xs text-foreground-muted">Current sellable quantity by product.</p></div>
          <Package className="h-5 w-5 text-foreground-muted" />
        </div>
        {onHand.length === 0 ? (
          <EmptyState title="No stock yet" description="Add stock above to start selling." />
        ) : (
          <ul className="space-y-2 text-sm">
            {onHand.map((r) => (
              <li key={r.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem]">
                <div className="min-w-0"><p className="truncate font-semibold text-foreground-heading">{r.name}</p><p className="mt-0.5 text-xs text-foreground-muted">{r.saleUnit}</p></div>
                <span className="text-right text-base font-bold text-primary">{formatBaseQuantity(r.availableBase, r.saleUnit)}</span>
                <span className="col-span-2 flex items-center gap-1.5 text-xs text-foreground-muted sm:col-span-1 sm:justify-end"><CalendarDays className="h-3.5 w-3.5" />{r.expiry ? `Expires ${new Date(r.expiry).toLocaleDateString("en-IN")}` : "No expiry"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-foreground-body">{children}</label>;
}
