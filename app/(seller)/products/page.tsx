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
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await productsApi.list({ q: q || undefined, page, limit: 50, status: "all", signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setMessage(!res.success || res.code === "offline_cache" ? res.message : "");
      if (res.success && res.data) { setItems(res.data.items); setPages(res.data.meta.totalPages); }
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, page]);

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
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by product name"
          className={`${inputCls} pl-9`}
        />
      </div>

      {message && <p role="status" className="text-sm text-foreground-muted">{message}</p>}
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
        <div className={`${cardCls} p-3 sm:p-4`}>
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p._id} className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border/70 bg-white px-3 py-3 transition hover:border-primary/40 hover:shadow-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-surface sm:h-16 sm:w-16">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-medium text-foreground-muted">No image</span>}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/products/${p.slug ?? p._id}`}
                    className="block truncate text-base font-semibold text-brand transition group-hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-foreground-muted sm:text-sm">
                    {p.sku} <span aria-hidden="true">·</span> {p.saleUnit}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={p.organicStatus} />
                    <StatusBadge status={p.status} />
                  </div>
                  <span className="shrink-0 text-base font-bold text-foreground-heading">
                    {typeof p.basePricePaise === "number" ? formatPaise(p.basePricePaise) : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 ? <div className="flex items-center justify-between border-t border-border pt-3 text-sm"><button disabled={page<=1} onClick={()=>setPage((p)=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>setPage((p)=>p+1)}>Next</button></div> : null}
        </div>
      )}
    </div>
  );
}
