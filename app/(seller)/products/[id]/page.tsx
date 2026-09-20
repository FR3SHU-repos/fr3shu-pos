"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { productsApi, suppliersApi } from "@/shared/lib/api";
import type { Producer, ProductDTO, SupplierDTO } from "@/shared/lib/api/products";
import { rupeesToPaise, paiseToRupees } from "@/shared/lib/money";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { ProducerFields, toProducerPayload } from "@/shared/components/products/ProducerFields";
import { uploadProductImage } from "@/shared/lib/supabase/product-images";

const ORGANIC = [
  "Verified",
  "InConversion",
  "PendingVerification",
  "Expired",
  "Rejected",
  "NotOrganic",
] as const;

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [priceRupees, setPriceRupees] = useState("");
  const [organicStatus, setOrganicStatus] = useState<(typeof ORGANIC)[number]>("PendingVerification");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">("active");
  const [producer, setProducer] = useState<Producer>({ kind: "self" });
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    suppliersApi.list().then((res) => {
      if (res.success && res.data) setSuppliers(res.data.items);
    });
    productsApi.get(id).then((res) => {
      if (res.success && res.data) {
        setProduct(res.data);
        if (res.data.slug && res.data.slug !== id) {
          router.replace(`/products/${res.data.slug}`);
        }
        setPriceRupees(
          typeof res.data.basePricePaise === "number"
            ? String(paiseToRupees(res.data.basePricePaise))
            : "",
        );
        setOrganicStatus(res.data.organicStatus);
        setStatus(res.data.status ?? "active");
        setProducer(res.data.producer ?? { kind: "self" });
      }
      setLoading(false);
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !product) return;
    setBusy(true);
    let imageUrl = product.imageUrl;
    try {
      if (image) imageUrl = await uploadProductImage(image, product.category ?? "uncategorized");
    } catch (error) {
      setBusy(false);
      return toast.error(error instanceof Error ? error.message : "Image upload failed.");
    }
    const res = await productsApi.update(id, {
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      saleUnit: product.saleUnit,
      basePricePaise: priceRupees ? rupeesToPaise(Number(priceRupees)) : undefined,
      taxRateBps: product.taxRateBps,
      organicStatus,
      status,
      isPinned: product.isPinned,
      producer: toProducerPayload(producer),
      imageUrl,
    });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.message);
    setProduct(res.data);
    setImage(null);
    toast.success("Product updated");
  }

  async function copyProductLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/products/${product?.slug ?? id}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (!product) return <p className="text-sm text-foreground-muted">Product not found.</p>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground-heading">{product.name}</h1>
          <p className="text-xs text-foreground-muted">
            SKU {product.sku}
            {product.barcode ? ` · barcode ${product.barcode}` : ""} · {product.saleUnit}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">Product link: /products/{product.slug}</p>
        </div>
        <StatusBadge status={product.organicStatus} />
      </header>

      <form onSubmit={save} className={`${cardCls} space-y-4`}>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-start">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-40 rounded-xl object-cover ring-1 ring-border" /> : <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-foreground-muted">No product image yet</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-body">Product image</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className={`${inputCls} w-full`} />
            <p className="mt-1 text-xs text-foreground-muted">Optional · JPG, PNG, or WebP up to 5 MB.</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">
            Base price (₹ per {product.saleUnit})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceRupees}
            onChange={(e) => setPriceRupees(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">Organic status</label>
          <select
            value={organicStatus}
            onChange={(e) => setOrganicStatus(e.target.value as (typeof ORGANIC)[number])}
            className={inputCls}
          >
            {ORGANIC.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputCls}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <ProducerFields value={producer} onChange={setProducer} suppliers={suppliers} />

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
          <button type="button" onClick={() => router.push("/products")} className={ghostBtnCls}>
            Back
          </button>
          <button type="button" onClick={() => void copyProductLink()} className={ghostBtnCls}>
            {copied ? "Link copied" : "Copy product link"}
          </button>
        </div>
      </form>
    </div>
  );
}
