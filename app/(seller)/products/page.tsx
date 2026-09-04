"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { productsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import {
  cardCls,
  EmptyState,
  inputCls,
  primaryBtnCls,
  SkeletonRows,
  StatusBadge,
} from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";

export default function ProductsPage() {
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await productsApi.list({ q: q || undefined, limit: 50 });
      if (res.success && res.data) setItems(res.data.items);
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground-heading">Products</h1>
        <Link href="/products/new" className={primaryBtnCls}>
          <Plus className="h-4 w-4" />
          New product
        </Link>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, SKU or barcode"
          className={`${inputCls} pl-9`}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Create your first organic product to start selling."
          action={
            <Link href="/products/new" className={primaryBtnCls}>
              <Plus className="h-4 w-4" />
              New product
            </Link>
          }
        />
      ) : (
        <div className={cardCls}>
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/products/${p._id}`}
                    className="block truncate text-sm font-medium text-brand"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-foreground-muted">
                    {p.sku} · {p.saleUnit}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.organicStatus} />
                  <StatusBadge status={p.status} />
                  <span className="text-sm font-semibold text-foreground-heading">
                    {typeof p.basePricePaise === "number" ? formatPaise(p.basePricePaise) : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
