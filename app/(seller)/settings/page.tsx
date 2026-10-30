"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { sellerOrgsApi } from "@/shared/lib/api";
import { identityApi } from "@/shared/lib/api";
import type { SellerBuyerReferral, SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import type { PrivacyRequest } from "@/shared/lib/api/identity";
import { cardCls, inputCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { buildUpiPaymentUri, isValidUpiId } from "@/shared/lib/upi";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";

type SellerProfileForm = {
  displayName: string;
  legalName: string;
  contactName: string;
  sellerType: SellerOrgType;
  phone: string;
  gstin: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export default function PaymentSettingsPage() {
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [buyerReferral, setBuyerReferral] = useState<SellerBuyerReferral | null>(null);
  const [email, setEmail] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [localities, setLocalities] = useState<Array<{ code: string; name: string; timezone: string; enabled: boolean; status: string }>>([]);
  const [profile, setProfile] = useState<SellerProfileForm>({ displayName: "", legalName: "", contactName: "", sellerType: "Retailer", phone: "", gstin: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<PrivacyRequest | null>(null);
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([sellerOrgsApi.getMyOrganization(), identityApi.locations(), identityApi.privacyRequests()]).then(([result, locationsResult, privacyResult]) => {
      if (result.success && result.data) {
        const organization = result.data.organization;
        const location = result.data.locations.find((item) => item.active) ?? result.data.locations[0];
        const address = organization.billingAddress ?? location?.address ?? {};
        setUpiId(organization.upiId ?? "");
        setPayeeName(organization.upiPayeeName ?? result.data.displayName ?? "");
        setBuyerReferral(result.data.buyerReferral ?? null);
        setEmail(result.data.email ?? "");
        setLocationCode(location?.code ?? "");
        setProfile({
          displayName: organization.displayName ?? "",
          legalName: organization.legalName ?? "",
          contactName: result.data.contactName ?? "",
          sellerType: organization.type ?? "Retailer",
          phone: (organization.phoneE164 ?? "").replace(/^\+91/, ""),
          gstin: organization.gstin ?? "",
          line1: address.line1 ?? "",
          line2: address.line2 ?? "",
          city: address.city ?? location?.name ?? "",
          state: address.state ?? "",
          postalCode: address.postalCode ?? "",
        });
      }
      if (locationsResult.success) setLocalities((locationsResult.data?.items ?? []).filter((item) => item.enabled && item.status === "enabled"));
      if (privacyResult.success) {
        const latest = (privacyResult.data?.items ?? []).filter((item) => item.requestType === "erasure")[0] ?? null;
        setDeletionRequest(latest);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function updateProfileField(key: keyof SellerProfileForm, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    const phoneE164 = normalizeIndianMobile(profile.phone);
    if (!profile.displayName.trim() || !profile.contactName.trim()) return toast.error("Enter the business name and contact person's name.");
    if (!phoneE164) return toast.error("Enter a valid 10-digit Indian mobile number.");
    if (!profile.line1.trim() || !profile.city.trim() || !profile.state.trim() || !/^\d{6}$/.test(profile.postalCode.trim())) return toast.error("Enter a complete business address and 6-digit PIN code.");
    if (!locationCode) return toast.error("Select a KOMOLA-enabled locality.");
    setProfileSaving(true);
    const result = await sellerOrgsApi.updateSellerProfile({
      displayName: profile.displayName.trim(),
      legalName: profile.legalName.trim(),
      contactName: profile.contactName.trim(),
      sellerType: profile.sellerType === "Rewardor" ? "Retailer" : profile.sellerType,
      phoneE164,
      gstin: profile.gstin.trim() || undefined,
      address: { line1: profile.line1.trim(), line2: profile.line2.trim(), city: profile.city.trim(), state: profile.state.trim(), postalCode: profile.postalCode.trim(), country: "India" },
      locationCode,
    });
    setProfileSaving(false);
    if (!result.success || !result.data) return toast.error(result.message || "Could not save seller profile.");
    const organization = result.data.organization;
    setEmail(result.data.email ?? email);
    setProfile((current) => ({ ...current, displayName: organization.displayName, legalName: organization.legalName, contactName: result.data?.contactName ?? current.contactName, phone: (organization.phoneE164 ?? phoneE164).replace(/^\+91/, ""), gstin: organization.gstin ?? current.gstin }));
    toast.success("Seller profile saved.");
  }

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

  async function requestAccountDeletion() {
    if (!window.confirm("Request seller account deletion? An administrator will review this. If approved, your identity, contact details and personal profile will be anonymized while sales, invoices, rewards and aggregate analytics are retained.")) return;
    setDeletionSubmitting(true);
    const result = await identityApi.submitPrivacyRequest("erasure", "Please review and anonymize my seller account identity, contact details and personal profile. Retain the de-identified sales, invoice, reward and analytics records required for business insights, accounting and fraud prevention.");
    setDeletionSubmitting(false);
    if (!result.success || !result.data) return toast.error(result.message || "Could not submit the account-deletion request.");
    setDeletionRequest(result.data);
    toast.success("Account-deletion request sent for admin review.");
  }

  if (loading) return <Skeleton className="h-72 w-full" />;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground-heading">Seller settings</h1>
      <p className="mt-1 text-sm text-foreground-muted">Manage your business profile and payment settings. Your login email cannot be changed here.</p>
      <section className={`${cardCls} mt-6`}>
        <h2 className="text-lg font-semibold text-foreground-heading">Business profile</h2>
        <p className="mt-1 text-sm text-foreground-muted">Keep the details shown on your seller workspace and receipts up to date.</p>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Business name<input className={`${inputCls} mt-1`} value={profile.displayName} onChange={(e) => updateProfileField("displayName", e.target.value)} /></label>
            <label className="block text-sm font-medium">Legal business name<input className={`${inputCls} mt-1`} value={profile.legalName} onChange={(e) => updateProfileField("legalName", e.target.value)} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Contact person<input className={`${inputCls} mt-1`} value={profile.contactName} onChange={(e) => updateProfileField("contactName", e.target.value)} /></label>
            <label className="block text-sm font-medium">Login email<input className={`${inputCls} mt-1 bg-surface`} value={email} readOnly disabled /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Mobile number<input className={`${inputCls} mt-1`} inputMode="numeric" maxLength={10} value={profile.phone} onChange={(e) => updateProfileField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
            <label className="block text-sm font-medium">Seller type<select className={`${inputCls} mt-1`} value={profile.sellerType} onChange={(e) => updateProfileField("sellerType", e.target.value)}>{["Farmer", "FPO", "Retailer", "Brand"].map((type) => <option key={type}>{type}</option>)}</select></label>
          </div>
          <label className="block text-sm font-medium">GSTIN <span className="font-normal text-foreground-muted">(optional)</span><input className={`${inputCls} mt-1`} value={profile.gstin} onChange={(e) => updateProfileField("gstin", e.target.value.toUpperCase())} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">Address line 1<input className={`${inputCls} mt-1`} value={profile.line1} onChange={(e) => updateProfileField("line1", e.target.value)} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Address line 2 <span className="font-normal text-foreground-muted">(optional)</span><input className={`${inputCls} mt-1`} value={profile.line2} onChange={(e) => updateProfileField("line2", e.target.value)} /></label>
            <label className="block text-sm font-medium">KOMOLA locality<select className={`${inputCls} mt-1`} value={locationCode} onChange={(e) => { setLocationCode(e.target.value); const locality = localities.find((item) => item.code === e.target.value); if (locality) updateProfileField("city", locality.name); }}>{localities.length ? localities.map((item) => <option key={item.code} value={item.code}>{item.name}</option>) : <option value="">No enabled localities</option>}</select></label>
            <label className="block text-sm font-medium">City<input className={`${inputCls} mt-1`} value={profile.city} onChange={(e) => updateProfileField("city", e.target.value)} /></label>
            <label className="block text-sm font-medium">State<input className={`${inputCls} mt-1`} value={profile.state} onChange={(e) => updateProfileField("state", e.target.value)} /></label>
            <label className="block text-sm font-medium">PIN code<input className={`${inputCls} mt-1`} inputMode="numeric" maxLength={6} value={profile.postalCode} onChange={(e) => updateProfileField("postalCode", e.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
          </div>
          <button type="button" className={primaryBtnCls} onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save business profile"}</button>
        </div>
      </section>
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
      <section className={`${cardCls} mt-6 max-w-2xl border-status-danger/30`}>
        <h2 className="text-lg font-semibold text-foreground-heading">Request account deletion</h2>
        <p className="mt-1 text-sm leading-6 text-foreground-muted">This is a review request, not an immediate deletion. An administrator will verify it before processing.</p>
        <div className="mt-4 rounded-xl bg-status-danger-surface p-4 text-sm leading-6 text-status-danger">
          Approved requests anonymize your login email, phone number, name, address, business contact details and other personal profile data. Your user ID is retained, and de-identified sales, invoices, rewards, inventory and market-insight records remain available where required for accounting, fraud prevention and analytics.
        </div>
        {deletionRequest ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-foreground-heading">Latest request</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{deletionRequest.status.replace("_", " ")}</span>
            </div>
            <p className="mt-2 text-sm text-foreground-muted">Submitted {new Date(deletionRequest.createdAt).toLocaleString("en-IN")}{deletionRequest.dueAt ? ` · Target response ${new Date(deletionRequest.dueAt).toLocaleDateString("en-IN")}` : ""}</p>
            {deletionRequest.responseNote ? <p className="mt-3 rounded-lg bg-surface-card p-3 text-sm text-foreground-muted">{deletionRequest.responseNote}</p> : null}
          </div>
        ) : null}
        {deletionRequest?.status === "submitted" || deletionRequest?.status === "in_review" ? null : (
          <button type="button" className="mt-4 rounded-xl border border-status-danger/40 px-4 py-3 text-sm font-bold text-status-danger disabled:opacity-50" onClick={requestAccountDeletion} disabled={deletionSubmitting}>{deletionSubmitting ? "Submitting…" : "Request account deletion"}</button>
        )}
      </section>
    </div>
  );
}
