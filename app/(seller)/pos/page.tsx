"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle2,
  Printer,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { productsApi, registersApi, salesApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { SessionDTO } from "@/shared/lib/api/registers";
import { usePosUser } from "@/shared/context/PosUserContext";
import {
  cardCls,
  EmptyState,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
  Skeleton,
} from "@/shared/components/ui";
import { cx } from "@/shared/lib/utils";
import { computeLineTotals, formatPaise, sumCartTotals } from "@/shared/lib/money";
import { SALE_UNIT_BASE, toBaseQuantity, type SaleUnit } from "@/shared/lib/units";
import { translator, LOCALES, type Locale } from "@/shared/lib/i18n";
import { ReceiptView } from "@/shared/components/pos/ReceiptView";
import { HELD_CARTS_KEY, type CartLine, type HeldCart } from "@/shared/components/pos/types";

type PayMethod = "cash" | "upi" | "split";

export default function PosPage() {
  const { user } = usePosUser();
  const [locale, setLocale] = useState<Locale>("en");
  const t = useMemo(() => translator(locale), [locale]);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [catalog, setCatalog] = useState<ProductDTO[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [held, setHeld] = useState<HeldCart[]>([]);

  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [cashPart, setCashPart] = useState("");
  const [upiPart, setUpiPart] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [tendered, setTendered] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<SaleDTO | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  // One idempotency key per cart attempt. Regenerated after a completed sale.
  const idemRef = useRef<string>(crypto.randomUUID());

  const load = useCallback(async () => {
    const [ov, pl] = await Promise.all([
      registersApi.overview(),
      productsApi.list({ limit: 200, status: "active" }),
    ]);
    if (ov.success && ov.data) setSession(ov.data.currentSession);
    if (pl.success && pl.data) setCatalog(pl.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HELD_CARTS_KEY);
      if (raw) setHeld(JSON.parse(raw) as HeldCart[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
  }, [loading]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.filter((p) => p.isPinned).slice(0, 12);
    return catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [catalog, query]);

  const lineTotals = useMemo(
    () =>
      lines.map((l) =>
        computeLineTotals({
          qtyBase: toBaseQuantity(l.qty, l.saleUnit),
          unitPricePaise: l.product.basePricePaise ?? 0,
          basePerSaleUnit: l.product.basePerSaleUnit,
          taxRateBps: l.product.taxRateBps ?? 0,
          discountPaise: l.discountPaise,
        }),
      ),
    [lines],
  );
  const cart = useMemo(() => sumCartTotals(lineTotals), [lineTotals]);

  function addProduct(p: ProductDTO) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product._id === p._id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: Number((copy[idx].qty + 1).toFixed(3)) };
        return copy;
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          product: p,
          qty: 1,
          saleUnit: p.saleUnit,
          discountPaise: 0,
        },
      ];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact =
      catalog.find((p) => (p.barcode ?? "").toLowerCase() === q) ??
      catalog.find((p) => p.sku.toLowerCase() === q) ??
      results[0];
    if (exact) addProduct(exact);
  }

  function setQty(key: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: Math.max(0, Number(qty.toFixed(3))) } : l)),
    );
  }
  function setUnit(key: string, unit: SaleUnit) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, saleUnit: unit } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function resetCart() {
    setLines([]);
    setShowPay(false);
    setPayMethod("cash");
    setCashPart("");
    setUpiPart("");
    setUpiRef("");
    setTendered("");
    setCustomerPhone("");
    setMarketingConsent(false);
    idemRef.current = crypto.randomUUID();
  }

  function persistHeld(next: HeldCart[]) {
    setHeld(next);
    try {
      localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function holdCart() {
    if (lines.length === 0) return;
    const entry: HeldCart = {
      id: crypto.randomUUID(),
      label: `${lines.length} item(s) · ${formatPaise(cart.netPaise)}`,
      savedAt: new Date().toISOString(),
      lines: lines.map((l) => ({
        productId: l.product._id,
        qty: l.qty,
        saleUnit: l.saleUnit,
        discountPaise: l.discountPaise,
      })),
    };
    persistHeld([entry, ...held].slice(0, 10));
    resetCart();
    toast.success("Cart held");
  }

  function resumeCart(entry: HeldCart) {
    const restored: CartLine[] = [];
    for (const l of entry.lines) {
      const product = catalog.find((p) => p._id === l.productId);
      if (product) {
        restored.push({ key: crypto.randomUUID(), product, qty: l.qty, saleUnit: l.saleUnit, discountPaise: l.discountPaise });
      }
    }
    setLines(restored);
    persistHeld(held.filter((h) => h.id !== entry.id));
    toast.success("Cart resumed");
  }

  async function completeSale() {
    if (submitting || lines.length === 0) return;

    const payments: { method: "cash" | "upi"; amountPaise: number; upiRef?: string }[] = [];
    if (payMethod === "cash") {
      payments.push({ method: "cash", amountPaise: cart.netPaise });
    } else if (payMethod === "upi") {
      payments.push({ method: "upi", amountPaise: cart.netPaise, upiRef: upiRef.trim() || undefined });
    } else {
      const cash = Math.round(Number(cashPart || 0) * 100);
      const upi = Math.round(Number(upiPart || 0) * 100);
      if (cash + upi !== cart.netPaise) {
        toast.error(`Split must total ${formatPaise(cart.netPaise)}`);
        return;
      }
      if (cash > 0) payments.push({ method: "cash", amountPaise: cash });
      if (upi > 0) payments.push({ method: "upi", amountPaise: upi, upiRef: upiRef.trim() || undefined });
    }

    setSubmitting(true);
    const res = await salesApi.create({
      idempotencyKey: idemRef.current,
      items: lines.map((l) => ({
        productId: l.product._id,
        qty: l.qty,
        saleUnit: l.saleUnit,
        discountPaise: l.discountPaise || undefined,
      })),
      payments,
      customerPhone: customerPhone.trim() || undefined,
      marketingConsent: marketingConsent || undefined,
    });
    setSubmitting(false);

    if (!res.success || !res.data) {
      toast.error(res.message || "Sale failed");
      return;
    }
    setCompleted(res.data.sale);
    void load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-md space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-status-success" />
        <div>
          <h1 className="text-xl font-semibold text-foreground-heading">{t("pos.sale_complete")}</h1>
          <p className="text-sm text-foreground-muted">
            {completed.receiptNo} · {formatPaise(completed.totalPaise)} · sync {completed.syncState}
          </p>
        </div>
        <ReceiptView sale={completed} orgName={user?.orgType} />
        <div className="flex justify-center gap-2 no-print">
          <button
            className={primaryBtnCls}
            onClick={() => {
              setCompleted(null);
              resetCart();
            }}
          >
            <Plus className="h-4 w-4" />
            {t("pos.new_sale")}
          </button>
          <button className={ghostBtnCls} onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t("pos.print_receipt")}
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <EmptyState
        title={t("pos.no_register")}
        action={
          <Link href="/register-sessions" className={primaryBtnCls}>
            {t("pos.title")} — open register
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left: search + results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-foreground-heading">{t("pos.title")}</h1>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs"
            aria-label="Language"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t("pos.search")}
            className={`${inputCls} pl-9`}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {results.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => addProduct(p)}
              className="flex min-h-16 flex-col items-start rounded-xl border border-border bg-surface-card p-3 text-left transition hover:border-border-focus"
            >
              <span className="line-clamp-2 text-sm font-medium text-foreground-heading">
                {p.name}
              </span>
              <span className="mt-1 text-xs text-foreground-muted">
                {typeof p.basePricePaise === "number" ? formatPaise(p.basePricePaise) : "—"} /{" "}
                {p.saleUnit}
              </span>
            </button>
          ))}
          {results.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-foreground-muted">
              {t("pos.empty_cart")}
            </p>
          ) : null}
        </div>

        {held.length > 0 ? (
          <div className={cardCls}>
            <p className="mb-2 text-xs font-semibold text-foreground-heading">
              {t("pos.resume")}
            </p>
            <ul className="space-y-1">
              {held.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">{h.label}</span>
                  <button
                    className="flex items-center gap-1 text-brand"
                    onClick={() => resumeCart(h)}
                  >
                    <PlayCircle className="h-4 w-4" />
                    {t("pos.resume")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Right: cart */}
      <div className={cx(cardCls, "flex h-fit flex-col lg:sticky lg:top-6")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground-heading">{t("pos.cart")}</h2>
          {lines.length > 0 ? (
            <button
              className="flex items-center gap-1 text-xs text-foreground-muted"
              onClick={holdCart}
            >
              <PauseCircle className="h-4 w-4" />
              {t("pos.hold")}
            </button>
          ) : null}
        </div>

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-muted">{t("pos.empty_cart")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l, i) => {
              const compatUnits = (["kg", "g", "l", "ml", "piece", "bunch", "pack"] as SaleUnit[]).filter(
                (u) => SALE_UNIT_BASE[u] === l.product.baseUnit,
              );
              return (
                <li key={l.key} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground-heading">
                        {l.product.name}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {l.product.organicStatus === "Verified"
                          ? t("pos.organic_verified")
                          : t("pos.organic_unverified")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeLine(l.key)}
                      aria-label={t("pos.remove")}
                      className="rounded-md p-1 text-foreground-muted hover:text-status-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border">
                      <button
                        className="grid h-9 w-9 place-items-center text-foreground-body"
                        onClick={() => setQty(l.key, l.qty - 1)}
                        aria-label="decrease"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={l.qty}
                        onChange={(e) => setQty(l.key, Number(e.target.value))}
                        className="h-9 w-16 border-x border-border text-center text-sm"
                      />
                      <button
                        className="grid h-9 w-9 place-items-center text-foreground-body"
                        onClick={() => setQty(l.key, l.qty + 1)}
                        aria-label="increase"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      value={l.saleUnit}
                      onChange={(e) => setUnit(l.key, e.target.value as SaleUnit)}
                      className="h-9 rounded-lg border border-border bg-surface-card px-2 text-sm"
                    >
                      {compatUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <span className="ml-auto text-sm font-semibold text-foreground-heading">
                      {formatPaise(lineTotals[i]?.netPaise ?? 0)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <Row label={t("pos.subtotal")} value={formatPaise(cart.grossPaise)} />
          <Row label={t("pos.discount")} value={`- ${formatPaise(cart.discountPaise)}`} />
          <Row label={t("pos.tax")} value={formatPaise(cart.taxPaise)} />
          <Row label={t("pos.total")} value={formatPaise(cart.netPaise)} strong />
        </dl>

        {!showPay ? (
          <button
            className={`${primaryBtnCls} mt-3 w-full`}
            disabled={lines.length === 0}
            onClick={() => {
              setShowPay(true);
              setTendered("");
              setCashPart(String((cart.netPaise / 100).toFixed(2)));
              setUpiPart("0");
            }}
          >
            {t("pos.pay")} · {formatPaise(cart.netPaise)}
          </button>
        ) : (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "split"] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={cx(
                    "min-h-11 rounded-lg border px-2 text-sm font-medium capitalize",
                    payMethod === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-card text-foreground-body",
                  )}
                >
                  {t(`pos.${m}`)}
                </button>
              ))}
            </div>

            {payMethod === "cash" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-body">
                  {t("pos.amount_tendered")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  {t("pos.change_due")}:{" "}
                  {formatPaise(Math.max(0, Math.round(Number(tendered || 0) * 100) - cart.netPaise))}
                </p>
              </div>
            ) : null}

            {payMethod === "upi" ? (
              <input
                placeholder={t("pos.upi_ref")}
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                className={inputCls}
              />
            ) : null}

            {payMethod === "split" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-body">
                      {t("pos.cash")} (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashPart}
                      onChange={(e) => setCashPart(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-body">
                      {t("pos.upi")} (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={upiPart}
                      onChange={(e) => setUpiPart(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <input
                  placeholder={t("pos.upi_ref")}
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  className={inputCls}
                />
              </div>
            ) : null}

            <input
              placeholder={t("pos.customer_phone")}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className={inputCls}
            />
            {customerPhone.trim() ? (
              <label className="flex items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                />
                Customer consents to marketing messages
              </label>
            ) : null}

            <button
              className={`${primaryBtnCls} w-full`}
              disabled={submitting}
              onClick={completeSale}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("pos.complete_sale")} · {formatPaise(cart.netPaise)}
            </button>
            <button
              className={`${ghostBtnCls} w-full`}
              onClick={() => setShowPay(false)}
              disabled={submitting}
            >
              Back to cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cx(
        "flex justify-between",
        strong ? "text-base font-semibold text-foreground-heading" : "text-foreground-body",
      )}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
