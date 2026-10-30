"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Pencil, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { salesApi } from "@/shared/lib/api";
import type { SaleDetail } from "@/shared/lib/api/sales";
import { useApi } from "@/shared/hooks/useApi";
import { ghostBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { formatPaise } from "@/shared/lib/money";
import { buildWhatsAppReceiptUrl } from "@/shared/lib/whatsapp-share";
import { printReceipt } from "@/shared/lib/offline/receipt-print";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    data: detail,
    error: loadError,
    loading,
    mutate: setDetail,
  } = useApi<SaleDetail>(() => salesApi.get(id), [id], { keepData: false });
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [action, setAction] = useState<"void" | "return" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (loadError) toast.error(loadError);
  }, [loadError]);

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
      if (!response.success || !response.data)
        throw new Error(response.message || "Could not update the receipt phone number.");
      setDetail((current) => (current ? { ...current, sale: response.data! } : current));
      setEditingPhone(false);
      toast.success("Receipt phone number updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the receipt phone number.",
      );
    } finally {
      setSavingPhone(false);
    }
  };
  const submitVoid = async () => {
    if (!actionReason.trim()) {
      toast.error("Add a reason before voiding this sale.");
      return;
    }
    setActionBusy(true);
    const response = await salesApi.voidSale(
      id,
      actionReason.trim(),
      globalThis.crypto.randomUUID(),
    );
    setActionBusy(false);
    if (!response.success || !response.data) {
      toast.error(response.message || "Could not void this sale.");
      return;
    }
    setDetail((current) => (current ? { ...current, sale: response.data! } : current));
    setAction(null);
    setActionReason("");
    toast.success("Sale voided");
  };
  const submitReturn = async () => {
    if (!actionReason.trim()) {
      toast.error("Add a reason before recording a return.");
      return;
    }
    const lines = sale.items
      .map((_line, index) => ({ saleLineNo: index + 1, qty: returnQty[index] ?? "0" }))
      .filter((line) => Number(line.qty) > 0);
    if (!lines.length) {
      toast.error("Enter a return quantity for at least one item.");
      return;
    }
    setActionBusy(true);
    const response = await salesApi.returnSale(id, {
      idempotencyKey: globalThis.crypto.randomUUID(),
      lines,
      reason: actionReason.trim(),
      refundSettlement: "pending",
    });
    setActionBusy(false);
    if (!response.success) {
      toast.error(response.message || "Could not record the return.");
      return;
    }
    setAction(null);
    setActionReason("");
    setReturnQty({});
    toast.success("Return recorded for review");
    const refreshed = await salesApi.get(id);
    if (refreshed.success && refreshed.data) setDetail(refreshed.data);
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
                onChange={(event) =>
                  setPhoneInput(event.target.value.replace(/\D/g, "").slice(0, 10))
                }
                autoFocus
              />
            </label>
            <button
              type="button"
              className={ghostBtnCls}
              disabled={savingPhone}
              onClick={() => void savePhone()}
            >
              Save
            </button>
            <button
              type="button"
              className="px-2 py-2 text-xs font-semibold text-foreground-muted"
              disabled={savingPhone}
              onClick={() => setEditingPhone(false)}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-4 text-sm no-print">
        <h2 className="font-semibold text-foreground-heading">Sale actions</h2>
        <p className="mt-1 text-foreground-muted">
          Correct a completed receipt with an audited void or return.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-status-danger/40 px-3 py-2 font-semibold text-status-danger disabled:opacity-50"
            onClick={() => {
              setAction("void");
              setActionReason("");
            }}
            disabled={actionBusy || sale.status === "voided"}
          >
            Void sale
          </button>
          <button
            type="button"
            className={ghostBtnCls}
            onClick={() => {
              setAction("return");
              setActionReason("");
            }}
            disabled={actionBusy || sale.status === "voided"}
          >
            Record return
          </button>
        </div>
        {action ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground-heading">
                {action === "void" ? "Void this sale" : "Return items"}
              </h3>
              <button
                type="button"
                className="text-sm text-foreground-muted"
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
            </div>
            {action === "return" ? (
              <div className="space-y-2">
                {sale.items.map((line, index) => (
                  <label
                    key={`${line.productId}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 text-foreground-heading">
                      {line.name}
                      <span className="ml-2 text-xs text-foreground-muted">
                        sold {line.qtyBase} {line.saleUnit}
                      </span>
                    </span>
                    <input
                      className="w-24 rounded-lg border border-border bg-surface-card px-2 py-1.5 text-right"
                      inputMode="decimal"
                      min="0"
                      max={line.qtyBase}
                      value={returnQty[index] ?? ""}
                      onChange={(event) =>
                        setReturnQty((current) => ({
                          ...current,
                          [index]: event.target.value.replace(/[^0-9.]/g, ""),
                        }))
                      }
                      placeholder="0"
                      aria-label={`Return quantity for ${line.name}`}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <label className="block text-xs font-medium text-foreground-body">
              Reason
              <input
                className={`${"mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground-heading"}`}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder={
                  action === "void" ? "Duplicate or incorrect sale" : "Customer return reason"
                }
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
              disabled={actionBusy}
              onClick={() => void (action === "void" ? submitVoid() : submitReturn())}
            >
              {actionBusy ? "Saving…" : action === "void" ? "Confirm void" : "Confirm return"}
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
