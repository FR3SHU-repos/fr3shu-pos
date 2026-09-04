"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { inventoryApi, lotsApi, productsApi } from "@/shared/lib/api";
import type { LotDTO } from "@/shared/lib/api/lots";
import type { InventoryBalanceDTO } from "@/shared/lib/api/inventory";
import type { ProductDTO } from "@/shared/lib/api/products";
import { usePosUser } from "@/shared/context/PosUserContext";
import {
  cardCls,
  EmptyState,
  inputCls,
  primaryBtnCls,
  SkeletonRows,
} from "@/shared/components/ui";
import { toBaseQuantity, formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";

const RECEIVABLE_ROLES = ["Owner", "Manager", "InventoryManager", "Admin"];

export default function LotsPage() {
  const { user } = usePosUser();
  const canReceive = !!user && RECEIVABLE_ROLES.includes(user.role);
  const locationId = user?.locationId ?? "";

  const [lots, setLots] = useState<LotDTO[]>([]);
  const [balances, setBalances] = useState<InventoryBalanceDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    productId: "",
    lotCode: "",
    qty: "",
    unit: "kg" as SaleUnit,
    producerName: "",
    expiryDate: "",
  });

  const load = useCallback(async () => {
    const [l, b, p] = await Promise.all([
      lotsApi.list(),
      inventoryApi.list(),
      productsApi.list({ limit: 100 }),
    ]);
    if (l.success && l.data) setLots(l.data.items);
    if (b.success && b.data) setBalances(b.data.items);
    if (p.success && p.data) {
      setProducts(p.data.items);
      setForm((f) => (f.productId ? f : { ...f, productId: p.data!.items[0]?._id ?? "" }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function receive(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!locationId) {
      toast.error("Your account has no assigned location");
      return;
    }
    const product = products.find((p) => p._id === form.productId);
    if (!product) return;
    setBusy(true);
    const res = await lotsApi.receive({
      productId: form.productId,
      lotCode: form.lotCode.trim(),
      receivedBase: toBaseQuantity(Number(form.qty || 0), form.unit),
      receivedUnit: form.unit,
      locationId,
      producerName: form.producerName.trim() || undefined,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success("Lot received into inventory");
    setForm((f) => ({ ...f, lotCode: "", qty: "", producerName: "", expiryDate: "" }));
    void load();
  }

  if (loading) return <SkeletonRows rows={5} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground-heading">Inventory &amp; lots</h1>

      {canReceive ? (
        <section className={cardCls}>
          <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Receive a lot</h2>
          {products.length === 0 ? (
            <p className="text-sm text-foreground-muted">Create a product first.</p>
          ) : (
            <form onSubmit={receive} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  className={inputCls}
                >
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Lot code</Label>
                <input
                  required
                  value={form.lotCode}
                  onChange={(e) => setForm((f) => ({ ...f, lotCode: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Quantity</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={form.qty}
                    onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as SaleUnit }))}
                    className={inputCls}
                  >
                    {(["kg", "g", "l", "ml", "piece", "bunch", "pack"] as SaleUnit[]).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Producer / farm name</Label>
                <input
                  value={form.producerName}
                  onChange={(e) => setForm((f) => ({ ...f, producerName: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Expiry / best-before</Label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className={primaryBtnCls}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Receive lot
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className={cardCls}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-heading">
          On-hand balances (your location)
        </h2>
        {balances.length === 0 ? (
          <EmptyState title="No stock on hand" description="Receive a lot to build inventory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Lot</th>
                  <th className="py-2 pr-4">Available</th>
                  <th className="py-2 pr-4">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balances.map((b) => (
                  <tr key={b._id}>
                    <td className="py-2 pr-4 font-medium text-foreground-heading">
                      {b.productName ?? b.productId}
                    </td>
                    <td className="py-2 pr-4">{b.lotCode ?? b.lotId}</td>
                    <td className="py-2 pr-4">
                      {formatBaseQuantity(b.availableBase, (b.saleUnit as SaleUnit) ?? "piece")}
                    </td>
                    <td className="py-2 pr-4 text-foreground-muted">
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Recent lots</h2>
        {lots.length === 0 ? (
          <p className="text-sm text-foreground-muted">No lots yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {lots.slice(0, 20).map((l) => (
              <li key={l._id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-medium text-foreground-heading">{l.lotCode}</span>
                <span className="text-foreground-muted">{l.producerName ?? "—"}</span>
                <span>
                  {l.certificationSnapshot?.isVerifiedOrganic ? "Organic verified" : "Unverified"}
                </span>
                <span className="text-foreground-muted">
                  exp {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("en-IN") : "—"}
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
