"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { productsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import toast from "react-hot-toast";
import { EmptyState, inputCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import { translator, LOCALES, type Locale } from "@/shared/lib/i18n";
import { toBaseQuantity } from "@/shared/lib/units";
import { formatPaise } from "@/shared/lib/money";
import { lineBasePerSaleUnit } from "@/shared/lib/pos/cart-lines";
import { ProductBarcodeScanner } from "@/shared/components/pos/ProductBarcodeScanner";
import { ProductGrid } from "@/shared/components/pos/ProductGrid";
import { HeldCartsList } from "@/shared/components/pos/HeldCartsList";
import { CartPanel } from "@/shared/components/pos/CartPanel";
import { CheckoutSheet } from "@/shared/components/pos/CheckoutSheet";
import { SaleCompleted } from "@/shared/components/pos/SaleCompleted";
import { useCart } from "@/shared/hooks/pos/useCart";
import { useBuyerLookup } from "@/shared/hooks/pos/useBuyerLookup";
import { useCheckout } from "@/shared/hooks/pos/useCheckout";
import { useHeldCarts } from "@/shared/hooks/pos/useHeldCarts";
import { usePosCatalog } from "@/shared/hooks/pos/usePosCatalog";
import { usePosRegister } from "@/shared/hooks/pos/usePosRegister";
import { usePosShortcuts } from "@/shared/hooks/pos/usePosShortcuts";

export default function PosPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useMemo(() => translator(locale), [locale]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Mobile-only view state: cart review overlay and which line's pack size is being adjusted.
  const [cartOpen, setCartOpen] = useState(false);
  const [adjustKey, setAdjustKey] = useState<string | null>(null);

  const { catalog, setCatalog, query, setQuery } = usePosCatalog();
  const register = usePosRegister(setCatalog);
  const { user, loading, online, session, store, setStore } = register;
  const cart = useCart();
  const buyer = useBuyerLookup();
  const checkout = useCheckout({
    lines: cart.lines,
    netPaise: cart.totals.netPaise,
    customer: buyer.customer,
    store,
    session,
    offlineScope: register.offlineScope,
    cashierId: user?.id ?? "",
    setCatalog,
    refreshPendingOfflineCount: register.refreshPendingOfflineCount,
    reload: register.reload,
  });

  function resetCart() {
    cart.clear();
    checkout.reset();
    buyer.reset();
    setCartOpen(false);
    setAdjustKey(null);
  }

  const { held, holdCart, resumeCart } = useHeldCarts({
    offlineScope: register.offlineScope,
    lines: cart.lines,
    netPaise: cart.totals.netPaise,
    catalog,
    setLines: cart.setLines,
    onHeld: resetCart,
  });

  useEffect(() => {
    searchRef.current?.focus();
  }, [loading]);

  usePosShortcuts({
    pay: () => {
      if (!checkout.showPay) checkout.startPay();
    },
    focusSearch: () => {
      checkout.setShowPay(false);
      setCartOpen(false);
      searchRef.current?.focus();
    },
  });

  const offlineShortfallLines = useMemo(
    () => !online ? cart.lines.map((line) => ({
      name: line.product.name,
      unit: line.saleUnit,
      shortfallBase: Math.max(0, toBaseQuantity(line.qty, line.saleUnit, lineBasePerSaleUnit(line)) - line.product.availableBase),
    })).filter((line) => line.shortfallBase > 0) : [],
    [cart.lines, online],
  );

  function addProduct(p: ProductDTO) {
    cart.addProduct(p);
    setQuery("");
    searchRef.current?.focus();
  }

  async function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim();
    if (!q) return;
    const byBarcode = await productsApi.lookup({ barcode: q });
    const bySKU = byBarcode.success ? byBarcode : await productsApi.lookup({ sku: q });
    const exact = bySKU.data ?? catalog[0];
    if (exact) addProduct(exact);
  }

  const scanProduct = async (code: string) => {
    const byBarcode = await productsApi.lookup({ barcode: code });
    const result = byBarcode.success ? byBarcode : await productsApi.lookup({ sku: code });
    if (!result.success || !result.data) { toast.error(result.message || "Product not found"); return; }
    addProduct(result.data);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (checkout.completed) {
    return (
      <SaleCompleted
        sale={checkout.completed}
        offline={checkout.completedOffline}
        store={store}
        cashierName={user?.name}
        payment={checkout.completedPayment}
        t={t}
        onNewSale={() => {
          checkout.setCompleted(null);
          resetCart();
        }}
      />
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

  const { lines, totals } = cart;
  const { showPay } = checkout;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
      {/* Left: search + results */}
      <div className="order-2 space-y-5 lg:order-none">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">{t("pos.title")}</h1>
            <p className="mt-1 text-sm text-foreground-muted">Tap a product to add it to the sale</p>
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="min-h-10 rounded-full bg-surface-muted px-3 text-xs font-semibold text-foreground-body"
            aria-label="Language"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex items-center rounded-full bg-surface-card p-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t("pos.search")}
            className={`${inputCls} rounded-full border-0 bg-transparent pl-10 shadow-none focus:ring-0`}
            autoComplete="off"
          />
          <ProductBarcodeScanner disabled={!online} onScan={(code) => void scanProduct(code)} />
        </div>

        <ProductGrid results={catalog} query={query} online={online} lines={lines} onAdd={addProduct} />
        <HeldCartsList held={held} onResume={resumeCart} t={t} />
      </div>

      {/* Mobile sticky cart bar: one primary action per screen */}
      {lines.length > 0 && !cartOpen && !showPay ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[5.25rem] z-30 flex min-h-14 items-center justify-between rounded-full bg-primary px-6 text-primary-foreground shadow-[0_12px_30px_rgba(0,0,0,0.45)] lg:hidden"
        >
          <span className="text-sm font-semibold">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-2 text-base font-bold">
            {formatPaise(totals.netPaise)} · Review sale
          </span>
        </button>
      ) : null}

      {/* Right: cart + checkout */}
      <CartPanel
        cart={cart}
        overlay={cartOpen || showPay}
        showPay={showPay}
        adjustKey={adjustKey}
        onToggleAdjust={(key) => setAdjustKey((k) => (k === key ? null : key))}
        onBack={() => (showPay ? checkout.setShowPay(false) : setCartOpen(false))}
        onHold={holdCart}
        onPay={checkout.startPay}
        t={t}
      >
        <CheckoutSheet
          checkout={checkout}
          buyer={buyer}
          netPaise={totals.netPaise}
          store={store}
          onStoreChange={(patch) => setStore((current) => ({ ...current, ...patch }))}
          pendingOfflineCount={register.pendingOfflineCount}
          offlineSessionSavedAt={register.offlineSessionSavedAt}
          offlineShortfallLines={offlineShortfallLines}
          t={t}
        />
      </CartPanel>
    </div>
  );
}
