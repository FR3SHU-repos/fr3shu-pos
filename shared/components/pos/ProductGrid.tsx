"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { CartLine } from "@/shared/components/pos/types";
import { primaryBtnCls } from "@/shared/components/ui";
import { cx } from "@/shared/lib/utils";
import { formatPaise } from "@/shared/lib/money";
import { formatProductQuantity } from "@/shared/lib/units";
import { remainingStockBase } from "@/shared/lib/pos-stock";

interface ProductGridProps {
  results: ProductDTO[];
  query: string;
  online: boolean;
  lines: CartLine[];
  onAdd: (product: ProductDTO) => void;
}

/** Tap-to-add product tiles with the empty / no-match states. */
export function ProductGrid({ results, query, online, lines, onAdd }: ProductGridProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground-muted">Products</h2>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground-muted">{results.length} available</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {results.map((p) => {
          const inCart = lines.find((line) => line.product._id === p._id);
          return (
            <button
              key={p._id}
              type="button"
              onClick={() => onAdd(p)}
              disabled={p.availableBase <= 0}
              className="group flex min-h-36 flex-col items-start rounded-3xl bg-surface-card p-3 text-left transition active:scale-[0.98] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="relative mb-3 flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-muted">
                                {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="(min-width: 1024px) 160px, 45vw" unoptimized className="object-cover" /> : <span className="text-[11px] text-foreground-muted">No image</span>}
              </div>
              <span className="line-clamp-2 text-sm font-semibold text-foreground-heading ">
                {p.name}
              </span>
              <span className="mt-1 text-sm font-bold text-foreground-heading">
                {typeof p.basePricePaise === "number" ? formatPaise(p.basePricePaise) : "—"} /{" "}
                {p.saleUnit}
              </span>
              <span className={cx("mt-auto pt-2 text-xs font-medium", p.availableBase > 0 ? "text-status-success" : "text-status-danger")}>
                {p.availableBase > 0 ? "Stock: " : "Out of stock · "}{formatProductQuantity(remainingStockBase(p.availableBase, inCart?.qty ?? 0, inCart?.saleUnit ?? p.saleUnit, p.basePerSaleUnit), p.saleUnit, p.baseUnit, p.basePerSaleUnit)}
              </span>
            </button>
          );
        })}
        {results.length === 0 ? (
          query.trim() ? (
            <p className="col-span-full py-6 text-center text-sm text-foreground-muted">
              No products match your search.
            </p>
          ) : (
            <div className="col-span-full flex flex-col items-center rounded-3xl bg-surface-card px-5 py-8 text-center">
              <p className="text-base font-semibold text-foreground-heading">No products added yet</p>
              <p className="mt-1 max-w-sm text-sm text-foreground-muted">Enter your product details to start selling from this register.</p>
              {online ? (
                <Link href="/products/new" className={`${primaryBtnCls} mt-4`}>
                  <Plus className="h-4 w-4" />
                  Enter product details
                </Link>
              ) : (
                <p className="mt-4 text-sm font-medium text-status-warning">Connect to the internet to create products.</p>
              )}
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
