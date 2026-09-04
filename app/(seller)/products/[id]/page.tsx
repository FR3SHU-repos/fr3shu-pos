"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { productsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import { rupeesToPaise, paiseToRupees } from "@/shared/lib/money";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, Skeleton, StatusBadge } from "@/shared/components/ui";
import { usePosUser } from "@/shared/context/PosUserContext";

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
  const { user } = usePosUser();
  const canEdit = !!user && ["Owner", "Manager", "Admin"].includes(user.role);

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [priceRupees, setPriceRupees] = useState("");
  const [organicStatus, setOrganicStatus] = useState<(typeof ORGANIC)[number]>("PendingVerification");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">("active");

  useEffect(() => {
    productsApi.get(id).then((res) => {
      if (res.success && res.data) {
        setProduct(res.data);
        setPriceRupees(
          typeof res.data.basePricePaise === "number"
            ? String(paiseToRupees(res.data.basePricePaise))
            : "",
        );
        setOrganicStatus(res.data.organicStatus);
        setStatus(res.data.status ?? "active");
      }
      setLoading(false);
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await productsApi.update(id, {
      basePricePaise: priceRupees ? rupeesToPaise(Number(priceRupees)) : undefined,
      organicStatus,
      status,
    });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.message);
    setProduct(res.data);
    toast.success("Product updated");
  }

  if (loading) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (!product) return <p className="text-sm text-foreground-muted">Product not found.</p>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground-heading">{product.name}</h1>
          <p className="text-xs text-foreground-muted">
            {product.sku} · {product.saleUnit} · base {product.baseUnit}
          </p>
        </div>
        <StatusBadge status={product.organicStatus} />
      </header>

      <form onSubmit={save} className={`${cardCls} space-y-4`}>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">
            Base price (₹ per {product.saleUnit})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!canEdit}
            value={priceRupees}
            onChange={(e) => setPriceRupees(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">Organic status</label>
          <select
            disabled={!canEdit}
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
            disabled={!canEdit}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputCls}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </div>

        {canEdit ? (
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primaryBtnCls}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
            <button type="button" onClick={() => router.push("/products")} className={ghostBtnCls}>
              Back
            </button>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">Your role cannot edit products.</p>
        )}
      </form>
    </div>
  );
}
