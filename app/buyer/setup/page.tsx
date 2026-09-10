"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { identityApi } from "@/shared/lib/api";
import { normalizeIndianWhatsApp } from "@/shared/lib/auth/whatsapp";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

export default function BuyerSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void identityApi.profile().then((result) => {
      if (!result.success || !result.data) return;
      setName(result.data.displayName);
      const existingPhone = result.data.contacts.find((contact) => contact.type === "phone" && contact.primary)
        ?? result.data.contacts.find((contact) => contact.type === "phone");
      if (existingPhone) setPhone(existingPhone.value.replace(/^\+91/, ""));
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const phoneE164 = normalizeIndianWhatsApp(phone);
    if (!phoneE164) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    const result = await identityApi.updateProfile(name.trim(), true, phoneE164);
    setBusy(false);
    if (!result.success) {
      setError(result.status === 409 ? "This mobile number is already linked to another KOMOLA account." : result.message);
      return;
    }
    router.replace("/buyer");
  }

  return <main className="flex min-h-screen items-center justify-center bg-surface p-4">
    <form onSubmit={submit} className={`${cardCls} w-full max-w-md space-y-5`}>
      <div>
        <p className="font-semibold text-primary">Buyer profile</p>
        <h1 className="mt-1 text-2xl font-semibold">Your details</h1>
        <p className="mt-2 text-sm text-foreground-muted">Sellers use these details to attach receipts and rewards to your account.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold" htmlFor="buyer-name">Full name <span className="text-primary">*</span></label>
        <input id="buyer-name" className={inputCls} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" />
      </div>
      <div>
        <label className="block text-sm font-semibold" htmlFor="buyer-phone">Mobile number <span className="text-primary">*</span></label>
        <div className="mt-1.5 flex">
          <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-surface-card px-4 text-sm font-semibold" aria-hidden="true">+91</span>
          <input id="buyer-phone" className={`${inputCls} mt-0 rounded-l-none`} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={10} pattern="[6-9][0-9]{9}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required />
        </div>
        <p className="mt-1.5 text-xs text-foreground-muted">Enter 10 digits. India&apos;s +91 code is added automatically. For now the number is verified immediately; OTP verification will be added later.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className={`${primaryBtnCls} min-h-12 w-full`} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
    </form>
  </main>;
}
