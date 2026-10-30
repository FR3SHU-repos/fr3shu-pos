"use client";

import { Loader2 } from "lucide-react";
import { ghostBtnCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { cx } from "@/shared/lib/utils";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";
import { formatPaise } from "@/shared/lib/money";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import type { PayMethod } from "@/shared/lib/pos/payment-state";
import type { PosStore } from "@/shared/hooks/pos/usePosRegister";
import type { CheckoutApi } from "@/shared/hooks/pos/useCheckout";
import type { BuyerLookupApi } from "@/shared/hooks/pos/useBuyerLookup";
import type { PosTranslator } from "@/shared/components/pos/translator";
import { CustomerBlock } from "@/shared/components/pos/CustomerBlock";
import { UpiQr } from "@/shared/components/pos/UpiQr";

export interface OfflineShortfallLine {
  name: string;
  unit: SaleUnit;
  shortfallBase: number;
}

interface CheckoutSheetProps {
  checkout: CheckoutApi;
  buyer: BuyerLookupApi;
  netPaise: number;
  store: PosStore;
  onStoreChange: (patch: Pick<PosStore, "upiId" | "upiPayeeName">) => void;
  pendingOfflineCount: number;
  offlineSessionSavedAt: number | null;
  offlineShortfallLines: OfflineShortfallLine[];
  t: PosTranslator;
}

const CHIP_CLS = "min-h-10 rounded-full bg-surface-muted px-4 text-sm font-semibold text-foreground-heading";

/** Payment method entry, customer identity and the confirm button. */
export function CheckoutSheet({
  checkout,
  buyer,
  netPaise,
  store,
  onStoreChange,
  pendingOfflineCount,
  offlineSessionSavedAt,
  offlineShortfallLines,
  t,
}: CheckoutSheetProps) {
  const { payment, dispatch, submitting, qrAmountPaise, upiPaymentUri } = checkout;
  const { customer } = buyer;
  const payeeName = store.upiPayeeName || store.name || "";
  const qr = (
    <UpiQr
      uri={upiPaymentUri}
      upiId={store.upiId}
      payeeName={payeeName}
      amountPaise={qrAmountPaise}
      onSaved={(upiId, upiPayeeName) => onStoreChange({ upiId, upiPayeeName })}
    />
  );
  const setField = (field: "tendered" | "cashPart" | "upiPart" | "upiAmount" | "upiRef") =>
    (e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: "set", field, value: e.target.value });

  return (
    <div className="mt-3 space-y-4">
      {pendingOfflineCount > 0 ? (
        <p className="rounded-lg bg-status-warning-surface px-3 py-2 text-xs font-medium text-status-warning">
          {pendingOfflineCount} offline sale{pendingOfflineCount === 1 ? "" : "s"} waiting to sync.
        </p>
      ) : null}
      {offlineSessionSavedAt ? (
        <p className="text-xs text-foreground-muted">
          Offline register prepared {new Date(offlineSessionSavedAt).toLocaleString()}.
        </p>
      ) : null}
      {offlineShortfallLines.length > 0 ? (
        <p role="alert" className="rounded-lg border border-status-warning/40 bg-status-warning-surface px-3 py-2 text-xs font-medium text-status-warning">
          This offline sale exceeds the saved stock for {offlineShortfallLines.map((line) => `${line.name} by ${formatBaseQuantity(line.shortfallBase, line.unit)}`).join(", ")}. The sale can be recorded, but the shortfall will be allocated as a stock adjustment for manager review when it syncs.
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {(["cash", "upi", "split"] as PayMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => dispatch({ type: "method", method: m, netPaise })}
            className={cx(
              "min-h-12 rounded-full px-2 text-sm font-semibold capitalize transition",
              payment.method === m
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-foreground-body",
            )}
          >
            {t(`pos.${m}`)}
          </button>
        ))}
      </div>

      {payment.method === "cash" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-body">
            {t("pos.amount_tendered")}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={payment.tendered}
            onChange={setField("tendered")}
            className={inputCls}
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Cash quick amounts">
            <button type="button" onClick={() => dispatch({ type: "exactCash", netPaise })} className={CHIP_CLS}>Exact</button>
            {[10, 20, 50, 100, 200, 500, 1000].map((n) => (
              <button key={n} type="button" onClick={() => dispatch({ type: "addCash", rupees: n })} className={CHIP_CLS}>+{n}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            {t("pos.change_due")}:{" "}
            {formatPaise(Math.max(0, Math.round(Number(payment.tendered || 0) * 100) - netPaise))}
          </p>
        </div>
      ) : null}

      {payment.method === "upi" ? (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-foreground-body">UPI amount (₹)
            <input type="number" min="0.01" step="0.01" value={payment.upiAmount} onChange={setField("upiAmount")} className={`${inputCls} mt-1`} />
          </label>
          {qr}
          <input placeholder={t("pos.upi_ref")} value={payment.upiRef} onChange={setField("upiRef")} className={inputCls} />
        </div>
      ) : null}

      {payment.method === "split" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                {t("pos.cash")} (₹)
              </label>
              <input type="number" min="0" step="0.01" value={payment.cashPart} onChange={setField("cashPart")} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                {t("pos.upi")} (₹)
              </label>
              <input type="number" min="0" step="0.01" value={payment.upiPart} onChange={setField("upiPart")} className={inputCls} />
            </div>
          </div>
          <input placeholder={t("pos.upi_ref")} value={payment.upiRef} onChange={setField("upiRef")} className={inputCls} />
          {Number(payment.upiPart) > 0 ? qr : null}
        </div>
      ) : null}

      <CustomerBlock buyer={buyer} t={t} />

      <button
        className={`${primaryBtnCls} w-full`}
        disabled={submitting || !customer.name.trim() || !normalizeIndianMobile(customer.phone) || (!customer.guest && !customer.resolved)}
        onClick={checkout.completeSale}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("pos.complete_sale")} · {formatPaise(netPaise)}
      </button>
      <button
        className={`${ghostBtnCls} w-full`}
        onClick={() => checkout.setShowPay(false)}
        disabled={submitting}
      >
        Back to cart
      </button>
    </div>
  );
}
