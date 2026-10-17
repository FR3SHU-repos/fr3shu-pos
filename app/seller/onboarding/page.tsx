"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerSeller, sellerDestination, type SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { identityApi } from "@/shared/lib/api";
import type { PlatformLocation } from "@/shared/lib/api/identity";
import { newUuid } from "@/shared/lib/uuid";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { KomoMessage } from "@/shared/components/mascot";
import { usePosUser } from "@/shared/context/PosUserContext";

type SellerForm = {
  displayName: string;
  legalName: string;
  sellerType: SellerOrgType;
  contactName: string;
  phone: string;
  referralCode: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const OPTIONAL_FIELDS: Array<keyof SellerForm> = ["legalName", "line2"];

export default function SellerOnboarding() {
  const router = useRouter();
  const { refresh } = usePosUser();
  const draft = typeof window !== "undefined"
    ? JSON.parse(sessionStorage.getItem("komola:seller-draft") || "{}")
    : {};
  const [form, setForm] = useState<SellerForm>({
    displayName: "",
    legalName: "",
    sellerType: (draft.sellerType || "Farmer") as SellerOrgType,
    contactName: draft.fullName || "",
    phone: draft.phone?.replace(/^\+91/, "") || "",
    referralCode: draft.referralCode || "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [locations, setLocations] = useState<PlatformLocation[]>([]);
  const [locationCode, setLocationCode] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  useEffect(() => {
    void identityApi.profile().then((result) => {
      if (!result.success || !result.data) return;
      const existingPhone = result.data.contacts.find((contact) => contact.type === "phone" && contact.primary)
        ?? result.data.contacts.find((contact) => contact.type === "phone");
      if (existingPhone) {
        setForm((current) => current.phone ? current : { ...current, phone: existingPhone.value.replace(/^\+91/, "") });
      }
    });
    void identityApi.locations().then((result) => {
      if (!result.success) {
        setError(result.status === 401 ? "Your session has expired. Please sign in again." : `We could not load KOMOLA-enabled localities (${result.message || `HTTP ${result.status}`}).`);
        setLocationsLoading(false);
        return;
      }
      if (!result.data?.items?.length) {
        setError("No KOMOLA localities are enabled right now. Please contact support.");
        setLocationsLoading(false);
        return;
      }
      const enabledLocations = result.data.items.filter((location) => location.enabled && location.status === "enabled");
      setLocations(enabledLocations);
      const selectedLocation = enabledLocations[0];
      setLocationCode(selectedLocation?.code ?? "");
      if (selectedLocation) setForm((form) => form.city ? form : { ...form, city: selectedLocation.name });
      setLocationsLoading(false);
    }).catch(() => {
      setError("We could not load KOMOLA-enabled localities. Please try again.");
      setLocationsLoading(false);
    });
  }, []);

  function update(key: keyof SellerForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");

    const displayName = form.displayName.trim();
    const contactName = form.contactName.trim();
    const addressLine = form.line1.trim();
    const state = form.state.trim();
    const postalCode = form.postalCode.trim();
    if (!displayName) {
      setError("Enter your business name.");
      return;
    }
    if (!contactName) {
      setError("Enter the contact person's name.");
      return;
    }
    if (!addressLine) {
      setError("Enter your business address.");
      return;
    }
    if (!state) {
      setError("Enter your state.");
      return;
    }
    if (!/^\d{6}$/.test(postalCode)) {
      setError("Enter a valid 6-digit PIN code.");
      return;
    }
    const phoneE164 = normalizeIndianMobile(form.phone);
    if (!phoneE164) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    const selectedLocation = locations.find((location) => location.code === locationCode);
    if (!selectedLocation) {
      setError("Select a KOMOLA-enabled locality.");
      return;
    }

    setBusy(true);
    try {
      const auth = createAuthBrowserClient().auth;
      let { data: { session } } = await auth.getSession();
      // The server callback writes the OAuth cookie before the browser client
      // has always hydrated its local session, especially in Safari. Refresh
      // once before telling the user to sign in again.
      if (!session) {
        ({ data: { session } } = await auth.refreshSession());
      }
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError("Your login session is not ready. Please sign in again and retry.");
        return;
      }
      const address = {
        line1: addressLine,
        line2: form.line2.trim(),
        city: form.city.trim(),
        state,
        postalCode,
        country: "India",
      };
      const result = await registerSeller({
        organization: {
          legalName: form.legalName.trim() || displayName,
          displayName,
          contactName,
          type: form.sellerType,
          phoneE164,
          referralCode: form.referralCode.trim().toUpperCase() || undefined,
          billingAddress: address,
        },
        location: { code: selectedLocation.code, name: selectedLocation.name, timezone: selectedLocation.timezone, phoneE164, address },
      }, newUuid(), accessToken);
      if (!result.success) {
        setError(result.message || "We could not save your seller details. Please try again.");
        return;
      }
      sessionStorage.removeItem("komola:seller-draft");
      // The provider bootstrapped before the organization existed. Refresh
      // it now so the next route can render the new seller profile without a
      // logout/login cycle.
      await refresh();
      router.replace(sellerDestination(result.data?.organization?.status));
    } catch {
      setError("We could not save your seller details. Please try again.");
    } finally {
      setBusy(false);
    }
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
    <form noValidate onSubmit={submit} className={`${cardCls} my-6 w-full max-w-xl space-y-5`}>
      <KomoMessage
        action="curious"
        title="Tell us a little about your business."
        description="These details help KOMOLA prepare your seller workspace."
        compact
      />
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
          <input id="seller-phone" className={inputCls} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={10} pattern="[6-9][0-9]{9}" value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} required />
          <p className="mt-1.5 text-xs text-foreground-muted">Enter the 10-digit Indian mobile number.</p>
        </div>
        <div>
          <label htmlFor="seller-referral-code" className="block text-sm font-semibold text-foreground-heading">Buyer referral code <span className="font-normal text-foreground-muted">(optional)</span></label>
          <input id="seller-referral-code" className={inputCls} type="text" autoComplete="off" placeholder="BYR-1A2B3C4D5E" maxLength={14} value={form.referralCode} onChange={(event) => update("referralCode", event.target.value.toUpperCase())} />
          <p className="mt-1.5 text-xs text-foreground-muted">Enter the KOMOLA buyer code shared by the person who introduced your business.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold">Business address</legend>
        {field("line1", "Address line 1", { autoComplete: "address-line1", placeholder: "Building, street or area" })}
        {field("line2", "Address line 2", { autoComplete: "address-line2", placeholder: "Landmark or locality" })}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="seller-city" className="block text-sm font-semibold text-foreground-heading">City / locality <span className="text-primary">*</span></label>
            <select id="seller-city" className={inputCls} value={locationCode} onChange={(event) => {
              const selected = locations.find((location) => location.code === event.target.value);
              setLocationCode(event.target.value);
              if (selected) update("city", selected.name);
            }} disabled={locationsLoading || locations.length === 0} required>
              <option value="">{locationsLoading ? "Loading enabled localities…" : "Select an enabled locality"}</option>
              {locations.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-foreground-muted">Only locations enabled by KOMOLA can accept seller applications.</p>
          </div>
          {field("state", "State", { autoComplete: "address-level1" })}
        </div>
        {field("postalCode", "PIN code", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "6-digit PIN code", maxLength: 6 })}
      </fieldset>

      {error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className={`${primaryBtnCls} min-h-12 w-full`} disabled={busy || locationsLoading || locations.length === 0}>{busy ? "Submitting…" : "Submit seller application"}</button>
    </form>
  </main>;
}
