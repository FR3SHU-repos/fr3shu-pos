"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { sellerOrgsApi } from "@/shared/lib/api";
import { cardCls, inputCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import { buildUpiPaymentUri, isValidUpiId } from "@/shared/lib/upi";

export default function PaymentSettingsPage() {
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void sellerOrgsApi.getMyOrganization().then((result) => {
      if (result.success && result.data) {
        setUpiId(result.data.organization.upiId ?? "");
        setPayeeName(result.data.organization.upiPayeeName ?? result.data.displayName ?? "");
      }
      setLoading(false);
    });
  }, []);

  const preview = isValidUpiId(upiId)
    ? buildUpiPaymentUri({ upiId, payeeName, amountPaise: 100, note: "KOMOLA payment preview" })
    : null;

  async function save() {
    if (upiId && !isValidUpiId(upiId)) {
      toast.error("Enter a valid UPI ID, for example seller@bank.");
      return;
    }
    setSaving(true);
    const result = await sellerOrgsApi.updatePaymentSettings({ upiId: upiId.trim(), upiPayeeName: payeeName.trim() });
    setSaving(false);
    if (!result.success) return toast.error(result.message || "Could not save payment settings.");
    window.dispatchEvent(new Event("komola:payment-settings-changed"));
    toast.success("UPI payment settings saved.");
  }

  if (loading) return <Skeleton className="h-72 w-full" />;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground-heading">Payment settings</h1>
      <p className="mt-1 text-sm text-foreground-muted">This UPI ID is used to create payment QR codes at checkout.</p>
      <section className={`${cardCls} mt-6 grid gap-6 md:grid-cols-[1fr_auto]`}>
        <div className="space-y-4">
          <label className="block text-sm font-medium">UPI ID
            <input className={`${inputCls} mt-1`} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="business@bank" autoCapitalize="none" />
          </label>
          <label className="block text-sm font-medium">Payee name
            <input className={`${inputCls} mt-1`} value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Business name shown in payment apps" />
          </label>
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save UPI settings"}</button>
        </div>
        <div className="grid min-h-48 min-w-48 place-items-center rounded-xl border border-border bg-white p-4">
          {preview ? <QRCodeSVG value={preview} size={160} title="UPI QR preview" /> : <p className="max-w-40 text-center text-sm text-foreground-muted">Enter a valid UPI ID to preview the QR.</p>}
        </div>
      </section>
    </div>
  );
}
