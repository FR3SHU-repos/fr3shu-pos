"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { salesApi } from "@/shared/lib/api";
import type { SaleDetail } from "@/shared/lib/api/sales";
import { ghostBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { formatPaise } from "@/shared/lib/money";
import { buildWhatsAppReceiptUrl } from "@/shared/lib/whatsapp-share";

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
  const receiptPayments = payments.map((p) => ({
    method: p.method === "cash" ? "Cash" : (p.method || "Paid").toUpperCase(),
    amountPaise: p.amountPaise,
    reference: p.upiRef,
  }));
  const shareOnWhatsApp = () => {
    const url = buildWhatsAppReceiptUrl(sale);
    if (!url) {
      toast.error("This sale does not have a valid Indian customer mobile number.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/pos/history" className="text-sm text-brand">
          ← Back to history
        </Link>
        <div className="flex gap-2">
          <button className={ghostBtnCls} onClick={shareOnWhatsApp}>
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </button>
          <button className={ghostBtnCls} onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between no-print">
        <h1 className="text-lg font-semibold text-foreground-heading">{sale.receiptNo}</h1>
        <StatusBadge status={sale.status} />
      </div>

      <ReceiptView sale={sale} payments={receiptPayments} />

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
      </div>

    </div>
  );
}
