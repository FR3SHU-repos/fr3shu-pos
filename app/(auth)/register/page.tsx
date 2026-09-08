"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import type { SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { Divider, GoogleButton, WhatsAppButton } from "@/shared/components/auth/parts";
import { identityApi } from "@/shared/lib/api";
import { authIntent, type AuthIntent } from "@/shared/lib/auth/intent";
import { reconcileIdentity } from "@/shared/lib/auth/gin";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "", sellerType: "Farmer" as SellerOrgType });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>(() => authIntent(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("as")));
  async function google() {
    if (googleBusy) return;
    setGoogleBusy(true); setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(intent === "buyer" ? "/buyer/setup" : "/seller/onboarding")}`;
    const { error } = await createAuthBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setGoogleBusy(false); setError("Google registration is temporarily unavailable."); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.fullName.trim().length < 2) return setError("Enter your full name.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { data, error } = await createAuthBrowserClient().auth.signUp({ email: form.email.trim().toLowerCase(), password: form.password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${intent === "buyer" ? "/buyer/setup" : "/seller/onboarding"}`, data: { display_name: form.fullName.trim() } } });
    setBusy(false);
    if (error) return setError("Registration could not be completed. Please try again.");
    if (intent === "seller") sessionStorage.setItem("komola:seller-draft", JSON.stringify({ fullName: form.fullName.trim(), sellerType: form.sellerType }));
    if (data.session && intent === "buyer") await identityApi.updateProfile(form.fullName.trim(), true);
    router.replace(data.session ? (intent === "buyer" ? "/buyer" : "/seller/onboarding") : "/auth/check-email");
  }
  return <main className="flex min-h-screen items-center justify-center bg-surface p-4"><form onSubmit={submit} className={`${cardCls} w-full max-w-md space-y-3`}>
    <h1 className="text-xl font-semibold">Create your KOMOLA account</h1>
    <div className="grid grid-cols-2 rounded-xl bg-surface p-1" role="tablist" aria-label="Choose experience">{(["buyer","seller"] as const).map(value=><button key={value} type="button" role="tab" aria-selected={intent===value} onClick={()=>setIntent(value)} className={`min-h-12 rounded-lg px-4 font-semibold capitalize ${intent===value?"bg-primary text-primary-foreground":"text-foreground-body"}`}>{value}</button>)}</div>
    <GoogleButton onClick={google} loading={googleBusy} />
    <WhatsAppButton onVerified={async()=>{await reconcileIdentity();router.replace(intent==="buyer"?"/buyer/setup":"/seller/onboarding")}} />
    <Divider />
    <input aria-label="Full name" className={inputCls} placeholder="Full name" value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} required />
    <input aria-label="Email" className={inputCls} type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
    <input aria-label="Password" className={inputCls} type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
    <input aria-label="Confirm password" className={inputCls} type="password" placeholder="Confirm password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required />
    {intent === "seller" && <select aria-label="Seller type" className={inputCls} value={form.sellerType} onChange={e=>setForm({...form,sellerType:e.target.value as SellerOrgType})}>{["Farmer","FPO","Retailer","Brand"].map(x=><option key={x}>{x}</option>)}</select>}
    {error && <p role="alert" aria-live="polite" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className={`${primaryBtnCls} w-full`}>{busy ? "Creating…" : "Create account"}</button>
    <p className="text-center text-sm"><Link href="/login" className="text-primary">Already registered? Sign in</Link></p>
  </form></main>;
}
