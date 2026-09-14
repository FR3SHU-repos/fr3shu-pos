"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Printer } from "lucide-react";
import { salesApi } from "@/shared/lib/api";
import type { SaleDetail, WhatsAppMessageStatus } from "@/shared/lib/api/sales";
import { ghostBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { formatPaise } from "@/shared/lib/money";
import toast from "react-hot-toast";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppMessages, setWhatsAppMessages] = useState<WhatsAppMessageStatus[]>([]);

  useEffect(() => {
    salesApi.get(id).then((res) => {
      if (res.success && res.data) setDetail(res.data);
      setLoading(false);
    });
    salesApi.whatsappMessages(id).then((res) => {
      if (res.success && res.data) setWhatsAppMessages(res.data.items);
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

  async function sendWhatsApp() {
    if (!sale.customerPhone || sendingWhatsApp) return;
    setSendingWhatsApp(true);
    const result = await salesApi.sendWhatsAppReceipt(sale._id);
    setSendingWhatsApp(false);
    if (result.success) {
      toast.success("WhatsApp receipt submitted");
      const messages = await salesApi.whatsappMessages(sale._id);
      if (messages.success && messages.data) setWhatsAppMessages(messages.data.items);
    } else {
      toast.error(result.message || "Could not send WhatsApp receipt");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/pos/history" className="text-sm text-brand">
          ← Back to history
        </Link>
        <div className="flex gap-2">
          <button className={ghostBtnCls} disabled={!sale.customerPhone || sendingWhatsApp} onClick={() => void sendWhatsApp()} title={sale.customerPhone ? "Send receipt to customer WhatsApp" : "Add a customer phone number to send WhatsApp receipt"}>
            <MessageCircle className="h-4 w-4" />
            {sendingWhatsApp ? "Sending..." : "WhatsApp"}
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
        <p className="mt-2 text-xs text-foreground-muted">
          Idempotency key: <span className="font-mono">{sale.idempotencyKey}</span>
        </p>
      </div>

      {whatsAppMessages.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-4 text-sm no-print">
          <h2 className="mb-2 font-semibold text-foreground-heading">WhatsApp receipt status</h2>
          <ul className="space-y-2">
            {whatsAppMessages.slice(0, 3).map((message) => (
              <li key={message.messageId} className="rounded-lg bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground-muted">{message.phone}</span>
                  <StatusBadge status={message.status} />
                </div>
                <p className="mt-1 text-xs text-foreground-muted">Submitted {new Date(message.submittedAt).toLocaleString("en-IN")}</p>
                {message.lastEventAt ? <p className="text-xs text-foreground-muted">Last update {new Date(message.lastEventAt).toLocaleString("en-IN")}</p> : null}
                {message.failureReason ? <p className="mt-1 text-xs font-medium text-status-danger">{message.failureReason}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
