"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { categoriesApi, productsApi } from "@/shared/lib/api";
import type { CategoryDTO } from "@/shared/lib/api/categories";
import { BASE_PER_SALE_UNIT, SALE_UNIT_BASE, type SaleUnit } from "@/shared/lib/units";
import { rupeesToPaise } from "@/shared/lib/money";
import {
  cardCls,
  ghostBtnCls,
  inputCls,
  PermissionDenied,
  primaryBtnCls,
} from "@/shared/components/ui";
import { usePosUser } from "@/shared/context/PosUserContext";

const SALE_UNITS: SaleUnit[] = ["kg", "g", "l", "ml", "piece", "bunch", "pack"];
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
  const { user } = usePosUser();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    saleUnit: "kg" as SaleUnit,
    basePriceRupees: "",
    taxRatePct: "0",
    organicStatus: "PendingVerification" as (typeof ORGANIC)[number],
  });

  useEffect(() => {
    categoriesApi.list().then((res) => {
      if (res.success && res.data) setCategories(res.data.items);
    });
  }, []);

  if (user && !["Owner", "Manager", "Admin"].includes(user.role)) {
    return <PermissionDenied />;
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await productsApi.create({
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId || undefined,
      saleUnit: form.saleUnit,
      baseUnit: SALE_UNIT_BASE[form.saleUnit],
      basePerSaleUnit: BASE_PER_SALE_UNIT[form.saleUnit],
      taxRateBps: Math.round(Number(form.taxRatePct || 0) * 100),
      basePricePaise: form.basePriceRupees
        ? rupeesToPaise(Number(form.basePriceRupees))
        : undefined,
      organicStatus: form.organicStatus,
      isPinned: false,
    });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.message);
    toast.success("Product created");
    router.push("/products");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-24">
      <h1 className="text-xl font-semibold text-foreground-heading">New organic product</h1>

      <form onSubmit={onSubmit} className={`${cardCls} space-y-4`}>
        <Text label="Name" value={form.name} onChange={(v) => set("name", v)} required />
        <div className="grid grid-cols-2 gap-3">
          <Text label="SKU" value={form.sku} onChange={(v) => set("sku", v)} required />
          <Text label="Barcode" value={form.barcode} onChange={(v) => set("barcode", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className={inputCls}
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Sale unit</Label>
            <select
              value={form.saleUnit}
              onChange={(e) => set("saleUnit", e.target.value as SaleUnit)}
              className={inputCls}
            >
              {SALE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Text
            label="Base price (₹ per sale unit)"
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
            Only <strong>Verified</strong> products are labelled as certified organic on receipts.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create product
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}
