"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { productsApi, suppliersApi } from "@/shared/lib/api";
import type { Producer, SupplierDTO } from "@/shared/lib/api/products";
import { CATEGORY_LIST, type CategorySlug } from "@/shared/lib/catalogue-categories";
import { defaultBaseMetadata, type BaseUnit, type SaleUnit } from "@/shared/lib/units";
import { rupeesToPaise } from "@/shared/lib/money";
import {
  cardCls,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
} from "@/shared/components/ui";
import { ProducerFields, toProducerPayload } from "@/shared/components/products/ProducerFields";
import { uploadProductImage } from "@/shared/lib/supabase/product-images";

const PRODUCT_UNITS: SaleUnit[] = ["kg", "g", "l", "ml", "piece", "bunch"];
const ORGANIC = [
  "Verified",
  "InConversion",
  "PendingVerification",
  "Expired",
  "Rejected",
  "NotOrganic",
] as const;

export default function NewProductPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [producer, setProducer] = useState<Producer>({ kind: "self" });
  const [image, setImage] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    categorySlug: "" as CategorySlug | "",
    saleUnit: "kg" as SaleUnit,
    baseUnit: "g" as BaseUnit,
    basePerSaleUnit: "1000",
    basePriceRupees: "",
    taxRatePct: "0",
    organicStatus: "PendingVerification" as (typeof ORGANIC)[number],
  });

  useEffect(() => {
    let cancelled = false;
    const updateOnline = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    void suppliersApi.list()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setSuppliers(res.data.items);
        else toast.error(res.message);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load suppliers.");
      });

    return () => {
      cancelled = true;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function selectSaleUnit(unit: SaleUnit) {
    const defaults = defaultBaseMetadata(unit);
    setForm((f) => ({ ...f, saleUnit: unit, baseUnit: defaults.baseUnit, basePerSaleUnit: String(defaults.basePerSaleUnit) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!online) {
      toast.error("Connect to the internet to create products. Offline product creation is disabled.");
      return;
    }
    setBusy(true);
    let imageUrl: string | undefined;
    try {
      const categoryName = CATEGORY_LIST.find((c) => c.slug === form.categorySlug)?.name ?? "uncategorized";
      if (image) imageUrl = await uploadProductImage(image, categoryName);
    } catch (error) {
      setBusy(false);
      return toast.error(error instanceof Error ? error.message : "Image upload failed.");
    }
    const res = await productsApi.create({
      name: form.name.trim(),
      categorySlug: form.categorySlug || undefined,
      saleUnit: form.saleUnit,
      baseUnit: form.baseUnit,
      basePerSaleUnit: Number(form.basePerSaleUnit),
      taxRateBps: Math.round(Number(form.taxRatePct || 0) * 100),
      basePricePaise: form.basePriceRupees
        ? rupeesToPaise(Number(form.basePriceRupees))
        : undefined,
      organicStatus: form.organicStatus,
      isPinned: false,
      producer: toProducerPayload(producer),
      imageUrl,
    });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.message);
    toast.success("Product created");
    router.push("/products");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-24">
      <h1 className="text-xl font-semibold text-foreground-heading">New agri product</h1>
      {!online ? (
        <p role="status" className="rounded-xl border border-status-warning/40 bg-status-warning-surface p-3 text-sm text-status-warning">
          Product creation is unavailable offline. Reconnect to upload this product to the shared catalogue.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className={`${cardCls} space-y-4`}>
        <Text label="Name" value={form.name} onChange={(v) => set("name", v)} required />
        <p className="-mt-2 text-xs text-foreground-muted">
          A SKU code and a printable barcode are generated automatically.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <select
              value={form.categorySlug}
              onChange={(e) => set("categorySlug", e.target.value as CategorySlug)}
              className={inputCls}
            >
              <option value="">— choose —</option>
              {CATEGORY_LIST.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Product unit</Label>
            <select
              value={form.saleUnit}
              onChange={(e) => selectSaleUnit(e.target.value as SaleUnit)}
              className={inputCls}
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Text
          label="Weight per unit"
          type="number"
          value={form.basePerSaleUnit}
          onChange={(v) => set("basePerSaleUnit", v)}
          required
        />
        <p className="-mt-2 text-xs text-foreground-muted">
          Enter how much one product unit represents.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Text
            label="Base price (₹ per unit)"
            type="number"
            value={form.basePriceRupees}
            onChange={(v) => set("basePriceRupees", v)}
          />
          <Text
            label="Tax rate (%)"
            type="number"
            value={form.taxRatePct}
            onChange={(v) => set("taxRatePct", v)}
          />
        </div>

        <div>
          <Label>Organic status</Label>
          <select
            value={form.organicStatus}
            onChange={(e) => set("organicStatus", e.target.value as (typeof ORGANIC)[number])}
            className={inputCls}
          >
            {ORGANIC.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground-muted">
            For your own records. Not shown on customer receipts.
          </p>
        </div>

        <ProducerFields value={producer} onChange={setProducer} suppliers={suppliers} />

        <div>
          <Label>Product image (optional)</Label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className={inputCls} />
          <p className="mt-1 text-xs text-foreground-muted">JPG, PNG, or WebP up to 5 MB. Stored under the selected category.</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={!online || busy} className={primaryBtnCls}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {online ? "Create product" : "Connect to create"}
          </button>
          <button type="button" onClick={() => router.back()} className={ghostBtnCls}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-foreground-body">{children}</label>;
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}
