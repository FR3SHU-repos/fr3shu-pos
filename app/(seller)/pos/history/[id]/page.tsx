"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Pencil, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { salesApi } from "@/shared/lib/api";
import type { SaleDetail } from "@/shared/lib/api/sales";
import { ghostBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { formatPaise } from "@/shared/lib/money";
import { buildWhatsAppReceiptUrl } from "@/shared/lib/whatsapp-share";
import { printReceipt } from "@/shared/lib/offline/receipt-print";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);

    void salesApi.get(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setDetail(res.data);
        else toast.error(res.message);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load sale.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
  const startPhoneEdit = () => {
    setPhoneInput((sale.customerPhone ?? "").replace(/\D/g, "").slice(-10));
    setEditingPhone(true);
  };
  const savePhone = async () => {
    if (!normalizeIndianMobile(phoneInput)) {
      toast.error("Enter a valid 10-digit Indian customer mobile number.");
      return;
    }
    setSavingPhone(true);
    try {
      const response = await salesApi.updateCustomerPhone(id, phoneInput);
      if (!response.success || !response.data) throw new Error(response.message || "Could not update the receipt phone number.");
      setDetail((current) => current ? { ...current, sale: response.data! } : current);
      setEditingPhone(false);
      toast.success("Receipt phone number updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the receipt phone number.");
    } finally {
      setSavingPhone(false);
    }
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
          <button className={ghostBtnCls} onClick={() => printReceipt()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between no-print">
        <h1 className="text-lg font-semibold text-foreground-heading">{sale.receiptNo}</h1>
        <StatusBadge status={sale.status} />
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-4 text-sm no-print">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground-heading">Customer phone</h2>
            <p className="text-foreground-muted">{sale.customerPhone || "Not recorded"}</p>
          </div>
          {!editingPhone ? (
            <button type="button" className={ghostBtnCls} onClick={startPhoneEdit}>
              <Pencil className="h-4 w-4" />
              Edit phone
            </button>
          ) : null}
        </div>
        {editingPhone ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-52 flex-1 text-xs font-medium text-foreground-body">
              Indian mobile number
              <input
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-heading"
                inputMode="numeric"
                maxLength={10}
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value.replace(/\D/g, "").slice(0, 10))}
                autoFocus
              />
            </label>
            <button type="button" className={ghostBtnCls} disabled={savingPhone} onClick={() => void savePhone()}>
              Save
            </button>
            <button type="button" className="px-2 py-2 text-xs font-semibold text-foreground-muted" disabled={savingPhone} onClick={() => setEditingPhone(false)}>
              Cancel
            </button>
          </div>
        ) : null}
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
