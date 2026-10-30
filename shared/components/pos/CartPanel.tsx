"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Minus, PauseCircle, Plus, Trash2 } from "lucide-react";
import type { CartLine } from "@/shared/components/pos/types";
import type { PosTranslator } from "@/shared/components/pos/translator";
import { inputCls, primaryBtnCls } from "@/shared/components/ui";
import { cx } from "@/shared/lib/utils";
import { formatPaise } from "@/shared/lib/money";
import {
  formatMeasurementValue,
  formatProductQuantity,
  measurementMetadata,
  measurementValue,
  MEASUREMENT_UNIT_LABELS,
  MEASUREMENT_UNITS,
  preferredMeasurementUnit,
  type MeasurementUnit,
  type SaleUnit,
} from "@/shared/lib/units";
import { remainingStockBase } from "@/shared/lib/pos-stock";
import { lineBasePerSaleUnit, lineBaseUnit, lineUnitPricePaise } from "@/shared/lib/pos/cart-lines";
import type { CartApi } from "@/shared/hooks/pos/useCart";

interface CartPanelProps {
  cart: CartApi;
  /** Mobile full-screen overlay is showing (cart review or checkout). */
  overlay: boolean;
  showPay: boolean;
  adjustKey: string | null;
  onToggleAdjust: (key: string) => void;
  onBack: () => void;
  onHold: () => void;
  onPay: () => void;
  t: PosTranslator;
  /** Checkout form, rendered below the totals while paying. */
  children?: ReactNode;
}

/** Cart lines, totals and the pay entry point. Becomes a full-screen sheet on mobile. */
export function CartPanel({ cart, overlay, showPay, adjustKey, onToggleAdjust, onBack, onHold, onPay, t, children }: CartPanelProps) {
  const { lines, lineTotals, totals } = cart;
  return (
    <div className={cx(
      "flex-col bg-surface-card lg:order-none lg:sticky lg:top-6 lg:flex lg:h-fit lg:rounded-3xl lg:p-5",
      overlay ? "fixed inset-0 z-50 flex overflow-y-auto bg-background p-4 pb-10" : "hidden",
    )}>
      <div className="mb-4 flex items-center justify-between gap-3 pb-2">
        <button
          type="button"
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-full bg-surface-muted text-foreground-body lg:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground-heading">{showPay ? "Checkout" : t("pos.cart")}</h2>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {showPay ? "Choose customer and payment" : `${lines.length} item${lines.length === 1 ? "" : "s"} · F2 to pay`}
          </p>
        </div>
        {lines.length > 0 ? (
          <button className="flex items-center gap-1 text-xs text-foreground-muted" onClick={onHold}>
            <PauseCircle className="h-4 w-4" />
            {t("pos.hold")}
          </button>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground-muted">{t("pos.empty_cart")}</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <CartLineItem
              key={l.key}
              line={l}
              netPaise={lineTotals[i]?.netPaise ?? 0}
              adjusting={adjustKey === l.key}
              cart={cart}
              onToggleAdjust={onToggleAdjust}
              t={t}
            />
          ))}
        </ul>
      )}

      <dl className="mt-4 space-y-1.5 pt-1 text-sm">
        <Row label={t("pos.subtotal")} value={formatPaise(totals.grossPaise)} />
        <Row label={t("pos.discount")} value={`- ${formatPaise(totals.discountPaise)}`} />
        <Row label={t("pos.tax")} value={formatPaise(totals.taxPaise)} />
        <Row label={t("pos.total")} value={formatPaise(totals.netPaise)} strong />
      </dl>

      {!showPay ? (
        <button className={`${primaryBtnCls} mt-3 w-full`} disabled={lines.length === 0} onClick={onPay}>
          {t("pos.pay")} · {formatPaise(totals.netPaise)}
        </button>
      ) : (
        children
      )}
    </div>
  );
}

interface CartLineItemProps {
  line: CartLine;
  netPaise: number;
  adjusting: boolean;
  cart: CartApi;
  onToggleAdjust: (key: string) => void;
  t: PosTranslator;
}

function CartLineItem({ line: l, netPaise, adjusting, cart, onToggleAdjust, t }: CartLineItemProps) {
  const baseUnit = lineBaseUnit(l);
  const basePerSaleUnit = lineBasePerSaleUnit(l);
  const selectedMeasurementUnit = l.measurementUnit ?? preferredMeasurementUnit(baseUnit, basePerSaleUnit, l.saleUnit);
  const selectedMeasurementValue = l.measurementValue ?? measurementValue(basePerSaleUnit, selectedMeasurementUnit);
  const hasMeasurement = basePerSaleUnit > 0;
  const compatUnits = [l.product.saleUnit];
  return (
    <li className="rounded-2xl bg-surface-muted p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground-heading">
            {l.product.name}
          </p>
        </div>
        <button
          onClick={() => cart.removeLine(l.key)}
          aria-label={t("pos.remove")}
          className="rounded-md p-1 text-foreground-muted hover:text-status-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-full bg-surface-card">
          <button
            className="grid h-11 w-11 place-items-center rounded-full text-foreground-body hover:bg-tertiary"
            onClick={() => cart.setQty(l.key, l.qty - 1)}
            aria-label={`Decrease ${l.product.name} quantity`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min="0"
            step="0.001"
            value={l.qty}
            onChange={(e) => cart.setQty(l.key, Number(e.target.value))}
            className="h-11 w-14 bg-transparent text-center text-sm font-semibold text-foreground-heading"
          />
          <button
            className="grid h-11 w-11 place-items-center rounded-full text-foreground-body hover:bg-tertiary"
            onClick={() => cart.setQty(l.key, l.qty + 1)}
            aria-label={`Increase ${l.product.name} quantity`}
            disabled={remainingStockBase(l.product.availableBase, l.qty, l.saleUnit, basePerSaleUnit) === 0}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <select
          value={l.saleUnit}
          onChange={(e) => cart.setUnit(l.key, e.target.value as SaleUnit)}
          className="h-11 rounded-full bg-surface-card px-3 text-sm text-foreground-body"
        >
          {compatUnits.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm font-semibold text-foreground-heading">
          {formatPaise(netPaise)}
        </span>
      </div>
      {hasMeasurement && adjusting ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="text-xs text-foreground-muted">
            Weight / unit
            <input
              type="number"
              min="1"
              step="0.001"
              value={selectedMeasurementValue}
              onChange={(e) => cart.setMeasurementValue(l.key, selectedMeasurementUnit, Number(e.target.value))}
              className={`${inputCls} mt-1 h-9 px-2 text-xs`}
              aria-label={`${l.product.name} weight per unit`}
            />
          </label>
          <label className="text-xs text-foreground-muted">
            Metric
            <select
              value={selectedMeasurementUnit}
              onChange={(e) => cart.setMeasurementUnit(l.key, e.target.value as MeasurementUnit)}
              className={`${inputCls} mt-1 h-9 px-2 text-xs`}
              aria-label={`${l.product.name} metric`}
            >
              {MEASUREMENT_UNITS.map((unit) => (
                <option key={unit} value={unit} disabled={measurementMetadata(unit).baseUnit !== baseUnit}>
                  {MEASUREMENT_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-foreground-muted">
            Price / unit
            <input
              type="number"
              min="0"
              step="0.01"
              value={(lineUnitPricePaise(l) / 100).toFixed(2)}
              onChange={(e) => cart.setPrice(l.key, Number(e.target.value))}
              className={`${inputCls} mt-1 h-9 px-2 text-xs`}
              aria-label={`${l.product.name} price per unit`}
            />
          </label>
        </div>
      ) : null}
      <p className="mt-1 text-xs text-foreground-muted">
        {hasMeasurement ? `Weight / unit: ${formatMeasurementValue(selectedMeasurementValue)} ${MEASUREMENT_UNIT_LABELS[selectedMeasurementUnit]} · ` : ""}
        Remaining stock: {formatProductQuantity(remainingStockBase(l.product.availableBase, l.qty, l.saleUnit, basePerSaleUnit), l.saleUnit, baseUnit, basePerSaleUnit)}
        {hasMeasurement ? (
          <button
            type="button"
            onClick={() => onToggleAdjust(l.key)}
            className="ml-2 font-semibold text-primary"
            aria-expanded={adjusting}
          >
            {adjusting ? "Done" : "Adjust"}
          </button>
        ) : null}
      </p>
    </li>
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
