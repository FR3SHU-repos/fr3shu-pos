"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { salesApi } from "@/shared/lib/api";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { cardCls, EmptyState, inputCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";

export default function SalesHistoryPage() {
  const [items, setItems] = useState<SaleDTO[]>([]);
  const [receiptNo, setReceiptNo] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await salesApi.list({
        limit: 50,
        receiptNo: receiptNo.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      if (res.success && res.data) setItems(res.data.items);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [receiptNo, phone]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-foreground-heading">Sales history</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="Receipt number"
            className={`${inputCls} pl-9`}
          />
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer phone"
          className={inputCls}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : items.length === 0 ? (
        <EmptyState title="No sales found" description="Completed sales will appear here." />
      ) : (
        <div className={cardCls}>
          <ul className="divide-y divide-border">
            {items.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/pos/history/${s._id}`} className="font-medium text-brand">
                  {s.receiptNo}
                </Link>
                <span className="text-foreground-muted">
                  {new Date(s.soldAt).toLocaleString("en-IN")}
                </span>
                <span className="text-foreground-muted">{s.items.length} item(s)</span>
                <StatusBadge status={s.status} />
                <span className="font-semibold text-foreground-heading">
                  {formatPaise(s.totalPaise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
