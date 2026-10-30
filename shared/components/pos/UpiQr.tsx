"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { sellerOrgsApi } from "@/shared/lib/api";
import { inputCls, primaryBtnCls } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { isValidUpiId } from "@/shared/lib/upi";

export function UpiQr({
  uri,
  upiId,
  payeeName,
  amountPaise,
  onSaved,
}: {
  uri: string | null;
  upiId?: string;
  payeeName: string;
  amountPaise: number;
  onSaved: (upiId: string, upiPayeeName: string) => void;
}) {
  const [draftUpiId, setDraftUpiId] = useState("");
  const [draftPayeeName, setDraftPayeeName] = useState(payeeName);
  const [saving, setSaving] = useState(false);

  if (!upiId) {
    return (
      <div className="space-y-3 rounded-lg bg-status-warning-surface p-3 text-sm text-status-warning">
        <p className="font-medium">Add this seller&apos;s UPI ID to display a payment QR.</p>
        <input className={inputCls} value={draftUpiId} onChange={(event) => setDraftUpiId(event.target.value)} placeholder="business@bank" autoCapitalize="none" />
        <input className={inputCls} value={draftPayeeName} onChange={(event) => setDraftPayeeName(event.target.value)} placeholder="Payee or business name" />
        <button
          type="button"
          className={primaryBtnCls}
          disabled={saving}
          onClick={async () => {
            if (!isValidUpiId(draftUpiId)) {
              toast.error("Enter a valid UPI ID, for example seller@bank.");
              return;
            }
            setSaving(true);
            const result = await sellerOrgsApi.updatePaymentSettings({ upiId: draftUpiId.trim(), upiPayeeName: draftPayeeName.trim() });
            setSaving(false);
            if (!result.success) {
              toast.error(result.message || "Could not save the UPI ID.");
              return;
            }
            onSaved(draftUpiId.trim(), draftPayeeName.trim());
            window.dispatchEvent(new Event("komola:payment-settings-changed"));
            toast.success("UPI ID saved for future payments.");
          }}
        >
          {saving ? "Saving…" : "Save and generate QR"}
        </button>
        <p className="text-xs text-status-warning">This is stored for this seller and reused at future checkouts. It can be changed later in <Link href="/settings" className="font-semibold underline">Payment settings</Link>.</p>
      </div>
    );
  }
  if (!uri || amountPaise <= 0) return <p className="text-xs text-foreground-muted">Enter a UPI amount to display the QR code.</p>;
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4 text-center">
      <QRCodeSVG value={uri} size={192} className="mx-auto" title={`Pay ${formatPaise(amountPaise)} by UPI`} />
      <p className="mt-3 text-lg font-bold text-foreground-heading">Pay {formatPaise(amountPaise)}</p>
      <p className="mt-1 text-xs text-foreground-muted">to {upiId}</p>
    </div>
  );
}
