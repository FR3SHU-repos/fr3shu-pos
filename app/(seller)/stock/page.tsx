"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { inventoryApi, productsApi, stockApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { InventoryBalanceDTO } from "@/shared/lib/api/inventory";
import { cardCls, EmptyState, inputCls, primaryBtnCls, SkeletonRows } from "@/shared/components/ui";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";

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
    toast.success(`Added ${qty.trim()} ${selected?.saleUnit ?? ""} to stock`);
    setQty("");
    setExpiry("");
    void load();
  }

  if (loading) return <SkeletonRows rows={5} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground-heading">Stock</h1>

      <section className={cardCls}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Add stock</h2>
        {products.length === 0 ? (
          <p className="text-sm text-foreground-muted">Add a product first.</p>
        ) : (
          <form onSubmit={addStock} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className={primaryBtnCls}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add stock
              </button>
              <p className="mt-2 text-xs text-foreground-muted">This adds to available stock.</p>
            </div>
          </form>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Available stock</h2>
        {onHand.length === 0 ? (
          <EmptyState title="No stock yet" description="Add stock above to start selling." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {onHand.map((r) => (
              <li key={r.productId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-foreground-heading">{r.name}</span>
                <span className="text-foreground-body">
                  {formatBaseQuantity(r.availableBase, r.saleUnit)}
                </span>
                <span className="text-foreground-muted">
                  {r.expiry ? `Expires ${new Date(r.expiry).toLocaleDateString("en-IN")}` : "No expiry"}
                </span>
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
