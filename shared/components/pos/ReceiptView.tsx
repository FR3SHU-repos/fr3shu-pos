import React from "react";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { formatPaise } from "@/shared/lib/money";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";

/** Compact, print-friendly receipt. Wrapped in #pos-receipt for the print stylesheet. */
export function ReceiptView({ sale, orgName }: { sale: SaleDTO; orgName?: string }) {
  return (
    <div
      id="pos-receipt"
      className="mx-auto max-w-xs rounded-xl border border-border bg-surface-card p-4 text-sm text-foreground-body"
    >
      <div className="text-center">
        <p className="font-semibold text-foreground-heading">{orgName ?? "Organic Store"}</p>
        <p className="text-xs text-foreground-muted">Receipt {sale.receiptNo}</p>
        <p className="text-xs text-foreground-muted">
          {new Date(sale.soldAt).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <ul className="space-y-1">
        {sale.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate">{it.name}</span>
              <span className="text-xs text-foreground-muted">
                {formatBaseQuantity(it.qtyBase, it.saleUnit as SaleUnit)} @{" "}
                {formatPaise(it.unitPricePaise)}
                {it.organic.isVerifiedOrganic ? " · organic ✓" : ""}
              </span>
            </span>
            <span className="whitespace-nowrap font-medium text-foreground-heading">
              {formatPaise(it.netPaise)}
            </span>
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-dashed border-border" />

      <dl className="space-y-1">
        <Row label="Gross" value={formatPaise(sale.grossPaise)} />
        <Row label="Discount" value={`- ${formatPaise(sale.discountPaise)}`} />
        <Row label="Tax" value={formatPaise(sale.taxPaise)} />
        <Row label="Total" value={formatPaise(sale.totalPaise)} strong />
      </dl>

      {sale.customerPhone ? (
        <p className="mt-3 text-xs text-foreground-muted">Customer: {sale.customerPhone}</p>
      ) : null}
      <p className="mt-3 text-center text-xs text-foreground-muted">Thank you</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-foreground-heading" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
