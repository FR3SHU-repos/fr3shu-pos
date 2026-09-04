"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { salesApi } from "@/shared/lib/api";
import type { SaleDetail } from "@/shared/lib/api/sales";
import { ghostBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { formatPaise } from "@/shared/lib/money";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    salesApi.get(id).then((res) => {
      if (res.success && res.data) setDetail(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Skeleton className="h-96 w-full max-w-md" />;
  if (!detail) return <p className="text-sm text-foreground-muted">Sale not found.</p>;

  const { sale, payments } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/pos/history" className="text-sm text-brand">
          ← Back to history
        </Link>
        <button className={ghostBtnCls} onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="flex items-center justify-between no-print">
        <h1 className="text-lg font-semibold text-foreground-heading">{sale.receiptNo}</h1>
        <StatusBadge status={sale.status} />
      </div>

      <ReceiptView sale={sale} />

      <div className="rounded-xl border border-border bg-surface-card p-4 text-sm no-print">
        <h2 className="mb-2 font-semibold text-foreground-heading">Payments</h2>
        <ul className="space-y-1">
          {payments.map((p) => (
            <li key={p._id} className="flex justify-between">
              <span className="capitalize text-foreground-muted">
                {p.method}
                {p.upiRef ? ` · ${p.upiRef}` : ""}
              </span>
              <span className="font-medium text-foreground-heading">
                {formatPaise(p.amountPaise)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-foreground-muted">
          Idempotency key: <span className="font-mono">{sale.idempotencyKey}</span>
        </p>
      </div>
    </div>
  );
}
