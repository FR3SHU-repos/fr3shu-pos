"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerSeller, type SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { normalizeIndianWhatsApp } from "@/shared/lib/auth/whatsapp";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

type SellerForm = {
  displayName: string;
  legalName: string;
  sellerType: SellerOrgType;
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const OPTIONAL_FIELDS: Array<keyof SellerForm> = ["legalName", "line2"];

export default function SellerOnboarding() {
  const router = useRouter();
  const draft = typeof window !== "undefined"
    ? JSON.parse(sessionStorage.getItem("komola:seller-draft") || "{}")
    : {};
  const [form, setForm] = useState<SellerForm>({
    displayName: "",
    legalName: "",
    sellerType: (draft.sellerType || "Farmer") as SellerOrgType,
    contactName: draft.fullName || "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key: keyof SellerForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const phoneE164 = normalizeIndianWhatsApp(form.phone);
    if (!phoneE164) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setBusy(true);
    const address = {
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: "India",
    };
    const displayName = form.displayName.trim();
    const result = await registerSeller({
      organization: {
        legalName: form.legalName.trim() || displayName,
        displayName,
        contactName: form.contactName.trim(),
        type: form.sellerType,
        phoneE164,
        billingAddress: address,
      },
      location: { code: "MAIN", name: displayName, phoneE164, address },
    }, crypto.randomUUID());
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    sessionStorage.removeItem("komola:seller-draft");
    router.replace("/dashboard");
  }

  function field(
    key: keyof SellerForm,
    label: string,
    options: { type?: string; inputMode?: "numeric" | "tel"; autoComplete?: string; placeholder?: string; maxLength?: number } = {},
  ) {
    const optional = OPTIONAL_FIELDS.includes(key);
    const id = `seller-${key}`;
    return <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground-heading">
        {label} <span className={optional ? "font-normal text-foreground-muted" : "text-primary"}>{optional ? "(optional)" : "*"}</span>
      </label>
      <input id={id} className={inputCls} type={options.type ?? "text"} inputMode={options.inputMode} autoComplete={options.autoComplete} placeholder={options.placeholder} maxLength={options.maxLength} value={form[key]} onChange={(event) => update(key, event.target.value)} required={!optional} />
    </div>;
  }

  return <main className="flex min-h-screen justify-center bg-surface p-4">
    <form onSubmit={submit} className={`${cardCls} my-6 w-full max-w-xl space-y-5`}>
      <div>
        <p className="font-semibold text-primary">Seller registration</p>
        <h1 className="mt-1 text-2xl font-semibold">Tell us about your business</h1>
        <p className="mt-2 text-sm text-foreground-muted"><span className="text-primary">*</span> Required fields</p>
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold">Business details</legend>
        {field("displayName", "Business name", { autoComplete: "organization", placeholder: "Name customers will see" })}
        {field("legalName", "Legal business name", { autoComplete: "organization" })}
        <div>
          <label htmlFor="seller-type" className="block text-sm font-semibold text-foreground-heading">Seller type <span className="text-primary">*</span></label>
          <select id="seller-type" className={inputCls} value={form.sellerType} onChange={(event) => update("sellerType", event.target.value)} required>
            {["Farmer", "FPO", "Retailer", "Brand"].map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold">Contact details</legend>
        {field("contactName", "Contact person", { autoComplete: "name", placeholder: "Full name" })}
        <div>
          <label htmlFor="seller-phone" className="block text-sm font-semibold text-foreground-heading">Mobile number <span className="text-primary">*</span></label>
          <div className="mt-1.5 flex">
            <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-surface-card px-4 text-sm font-semibold" aria-hidden="true">+91</span>
            <input id="seller-phone" className={`${inputCls} mt-0 rounded-l-none`} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={10} pattern="[6-9][0-9]{9}" value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} required />
          </div>
          <p className="mt-1.5 text-xs text-foreground-muted">Enter the 10-digit number. India&apos;s +91 code is added automatically.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold">Business address</legend>
        {field("line1", "Address line 1", { autoComplete: "address-line1", placeholder: "Building, street or area" })}
        {field("line2", "Address line 2", { autoComplete: "address-line2", placeholder: "Landmark or locality" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("city", "City", { autoComplete: "address-level2" })}
          {field("state", "State", { autoComplete: "address-level1" })}
        </div>
        {field("postalCode", "PIN code", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "6-digit PIN code", maxLength: 6 })}
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className={`${primaryBtnCls} min-h-12 w-full`} disabled={busy}>{busy ? "Submitting…" : "Submit seller application"}</button>
    </form>
  </main>;
}
