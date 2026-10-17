"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { sellerOrgsApi } from "@/shared/lib/api";
import type { SellerBuyerReferral } from "@/shared/lib/api/sellerOrgs";
import { cardCls, inputCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { buildUpiPaymentUri, isValidUpiId } from "@/shared/lib/upi";

export default function PaymentSettingsPage() {
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [buyerReferral, setBuyerReferral] = useState<SellerBuyerReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void sellerOrgsApi.getMyOrganization().then((result) => {
      if (result.success && result.data) {
        setUpiId(result.data.organization.upiId ?? "");
        setPayeeName(result.data.organization.upiPayeeName ?? result.data.displayName ?? "");
        setBuyerReferral(result.data.buyerReferral ?? null);
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

  async function linkReferral() {
    const code = referralCode.trim().toUpperCase();
    if (!/^BYR-[A-F0-9]{10}$/.test(code)) {
      toast.error("Enter a valid buyer code, for example BYR-1A2B3C4D5E.");
      return;
    }
    setSaving(true);
    const result = await sellerOrgsApi.linkBuyerReferral(code);
    setSaving(false);
    if (!result.success) return toast.error(result.message || "Could not link the buyer referral.");
    setReferralCode("");
    const refreshed = await sellerOrgsApi.getMyOrganization();
    if (refreshed.success && refreshed.data) setBuyerReferral(refreshed.data.buyerReferral ?? null);
    toast.success("Buyer referral linked. Future eligible sales will earn referral coins.");
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
      <section className={`${cardCls} mt-6 max-w-2xl`}>
        <h2 className="text-lg font-semibold text-foreground-heading">Buyer referral</h2>
        <p className="mt-1 text-sm text-foreground-muted">If a buyer introduced your business, enter their buyer code. This also works for an existing seller account.</p>
        {buyerReferral ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Linked buyer account</p>
                <p className="mt-1 text-lg font-semibold text-foreground-heading">{buyerReferral.buyerName}</p>
                <p className="mt-1 font-mono text-sm text-foreground-muted">{buyerReferral.buyerCode}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{buyerReferral.status}</span>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div><p className="text-xs text-foreground-muted">Referral coins earned</p><p className="mt-1 text-lg font-bold text-status-success">{buyerReferral.awardedCoins.toLocaleString("en-IN")}</p></div>
              <div><p className="text-xs text-foreground-muted">Eligible sales</p><p className="mt-1 text-lg font-bold text-foreground-heading">{formatPaise(buyerReferral.eligibleSalesMinor)}</p></div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input className={inputCls} value={referralCode} onChange={(event) => setReferralCode(event.target.value.toUpperCase())} placeholder="BYR-1A2B3C4D5E" maxLength={14} autoComplete="off" />
          <button type="button" className={`${primaryBtnCls} whitespace-nowrap`} onClick={linkReferral} disabled={saving}>{saving ? "Linking…" : "Link buyer code"}</button>
        </div>
      </section>
    </div>
  );
}
