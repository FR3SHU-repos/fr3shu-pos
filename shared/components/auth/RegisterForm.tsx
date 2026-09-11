"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import type { SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { Divider, GoogleButton, WhatsAppButton } from "@/shared/components/auth/parts";
import type { AuthIntent } from "@/shared/lib/auth/intent";
import { reconcileIdentity } from "@/shared/lib/auth/gin";
import { normalizeIndianWhatsApp } from "@/shared/lib/auth/whatsapp";
import { identityApi } from "@/shared/lib/api";

export function RegisterForm({ intent }: { intent: AuthIntent }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "", confirm: "", sellerType: "Farmer" as SellerOrgType });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  async function google() {
    if (googleBusy) return;
    setGoogleBusy(true); setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(intent === "buyer" ? "/buyer/setup" : "/seller/onboarding")}&as=${intent}`;
    const { error } = await createAuthBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setGoogleBusy(false); setError("Google registration is temporarily unavailable."); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.fullName.trim().length < 2) return setError("Enter your full name.");
    const buyerPhone = intent === "buyer" ? normalizeIndianWhatsApp(form.phone) : undefined;
    if (intent === "buyer" && !buyerPhone) return setError("Enter a valid 10-digit Indian mobile number.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { data, error } = await createAuthBrowserClient().auth.signUp({ email: form.email.trim().toLowerCase(), password: form.password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${intent === "buyer" ? "/buyer/setup" : "/seller/onboarding"}`, data: { display_name: form.fullName.trim(), ...(buyerPhone ? { buyer_phone_e164: buyerPhone } : {}) } } });
    if (error) { setBusy(false); return setError("Registration could not be completed. Please try again."); }
    if (intent === "seller") sessionStorage.setItem("komola:seller-draft", JSON.stringify({ fullName: form.fullName.trim(), sellerType: form.sellerType }));
    if (data.session && intent === "buyer" && buyerPhone) {
      await reconcileIdentity(data.session.access_token);
      const profile = await identityApi.updateProfile(form.fullName.trim(), true, buyerPhone);
      setBusy(false);
      if (!profile.success) return setError(profile.status === 409 ? "This mobile number is already linked to another KOMOLA account." : profile.message);
      router.replace("/buyer");
      return;
    }
    setBusy(false);
    router.replace(data.session ? "/seller/onboarding" : "/auth/check-email");
  }
  return <main className="flex min-h-screen items-center justify-center bg-surface p-4"><form onSubmit={submit} className={`${cardCls} w-full max-w-md space-y-3`}>
    <div><h1 className="text-xl font-semibold capitalize">Create your {intent} account</h1><p className="mt-1 text-sm text-foreground-muted">Register for the {intent === "buyer" ? "rewards and receipts" : "point-of-sale"} portal.</p><Link href="/register" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Choose a different account type</Link></div>
    <GoogleButton onClick={google} loading={googleBusy} />
    <WhatsAppButton onVerified={async()=>{await reconcileIdentity();router.replace(intent==="buyer"?"/buyer/setup":"/seller/onboarding")}} />
    <Divider />
    <input aria-label="Full name" className={inputCls} placeholder="Full name" value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} required />
    {intent === "buyer" && <div><label className="mb-1.5 block text-sm font-semibold" htmlFor="register-phone">Mobile number <span className="text-primary">*</span></label><div className="flex"><span className="flex items-center rounded-l-xl border border-r-0 border-border bg-surface-card px-4 text-sm font-semibold" aria-hidden="true">+91</span><input id="register-phone" className={`${inputCls} mt-0 rounded-l-none`} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={10} pattern="[6-9][0-9]{9}" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g, "").slice(0, 10)})} required /></div><p className="mt-1.5 text-xs text-foreground-muted">For now this number is verified immediately. OTP verification will be added later.</p></div>}
    <input aria-label="Email" className={inputCls} type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
    <input aria-label="Password" className={inputCls} type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
    <input aria-label="Confirm password" className={inputCls} type="password" placeholder="Confirm password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required />
    {intent === "seller" && <select aria-label="Seller type" className={inputCls} value={form.sellerType} onChange={e=>setForm({...form,sellerType:e.target.value as SellerOrgType})}>{["Farmer","FPO","Retailer","Brand"].map(x=><option key={x}>{x}</option>)}</select>}
    {error && <p role="alert" aria-live="polite" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className={`${primaryBtnCls} w-full`}>{busy ? "Creating…" : "Create account"}</button>
    <p className="text-center text-sm"><Link href={`/login/${intent}`} className="text-primary">Already registered? Sign in as a {intent}</Link></p>
  </form></main>;
}
