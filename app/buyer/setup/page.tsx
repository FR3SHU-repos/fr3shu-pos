"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { identityApi } from "@/shared/lib/api";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

export default function BuyerSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("Visakhapatnam");
  const [state, setState] = useState("Andhra Pradesh");
  const [postalCode, setPostalCode] = useState("");
  const [locationCode, setLocationCode] = useState("visakhapatnam");
  const [locations, setLocations] = useState<Array<{ code: string; name: string }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void identityApi.profile().then((result) => {
      if (!result.success || !result.data) return;
      setName(result.data.displayName);
      const existingPhone = result.data.contacts.find((contact) => contact.type === "phone" && contact.primary)
        ?? result.data.contacts.find((contact) => contact.type === "phone");
      if (existingPhone) setPhone(existingPhone.value.replace(/^\+91/, ""));
      if (result.data.locationCode) setLocationCode(result.data.locationCode);
      if (result.data.address) {
        setLine1(result.data.address.line1 ?? "");
        setLine2(result.data.address.line2 ?? "");
        setCity(result.data.address.city ?? "Visakhapatnam");
        setState(result.data.address.state ?? "Andhra Pradesh");
        setPostalCode(result.data.address.postalCode ?? "");
      }
    });
    void identityApi.locations().then((result) => {
      if (result.success && result.data?.items?.length) {
        const items = result.data.items;
        setLocations(items);
        setLocationCode((current) => items.some((location) => location.code === current) ? current : items[0].code);
      }
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const phoneE164 = normalizeIndianMobile(phone);
    if (!phoneE164) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !/^\d{6}$/.test(postalCode.trim())) {
      setError("Enter your complete Indian address and 6-digit PIN code.");
      return;
    }
    setBusy(true);
    const result = await identityApi.updateProfile(name.trim(), true, phoneE164, locationCode, { line1: line1.trim(), line2: line2.trim(), city: city.trim(), state: state.trim(), postalCode: postalCode.trim(), country: "India" });
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
        <input id="buyer-phone" className={inputCls} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={10} pattern="[6-9][0-9]{9}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required />
        <p className="mt-1.5 text-xs text-foreground-muted">Enter 10 digits. The number is stored as unverified contact information and cannot be used to sign in.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold" htmlFor="buyer-location">Location <span className="text-primary">*</span></label>
        <select id="buyer-location" className={inputCls} value={locationCode} onChange={(event) => setLocationCode(event.target.value)} required>
          {(locations.length ? locations : [{ code: "visakhapatnam", name: "Visakhapatnam" }]).map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}
        </select>
        <p className="mt-1.5 text-xs text-foreground-muted">You will see rewards and offers enabled for this location.</p>
      </div>
      <fieldset className="space-y-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Address <span className="text-primary">*</span></legend>
        <div><label className="block text-sm font-semibold" htmlFor="buyer-line1">Address line 1 <span className="text-primary">*</span></label><input id="buyer-line1" className={inputCls} value={line1} onChange={(event) => setLine1(event.target.value)} autoComplete="address-line1" required /></div>
        <div><label className="block text-sm font-semibold" htmlFor="buyer-line2">Address line 2 <span className="text-xs font-normal text-foreground-muted">(optional)</span></label><input id="buyer-line2" className={inputCls} value={line2} onChange={(event) => setLine2(event.target.value)} autoComplete="address-line2" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-semibold" htmlFor="buyer-city">City <span className="text-primary">*</span></label><input id="buyer-city" className={inputCls} value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required /></div><div><label className="block text-sm font-semibold" htmlFor="buyer-state">State <span className="text-primary">*</span></label><input id="buyer-state" className={inputCls} value={state} onChange={(event) => setState(event.target.value)} autoComplete="address-level1" required /></div></div>
        <div><label className="block text-sm font-semibold" htmlFor="buyer-postal-code">PIN code <span className="text-primary">*</span></label><input id="buyer-postal-code" className={inputCls} value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="postal-code" maxLength={6} required /></div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className={`${primaryBtnCls} min-h-12 w-full`} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
    </form>
  </main>;
}
