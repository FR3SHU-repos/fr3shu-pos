import React from "react";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { formatPaise } from "@/shared/lib/money";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";

export interface ReceiptPaymentLine {
  /** Display label, e.g. "Cash", "UPI", "Card". */
  method: string;
  amountPaise: number;
  reference?: string;
}

/**
 * Branded, thermal-friendly receipt. All visual styling lives in
 * `#pos-receipt` rules in globals.css so it survives the print stylesheet.
 */
export function ReceiptView({
  sale,
  orgName,
  locationName,
  cashierName,
  payments,
  changePaise,
}: {
  sale: SaleDTO;
  orgName?: string;
  locationName?: string;
  cashierName?: string;
  payments?: ReceiptPaymentLine[];
  changePaise?: number;
}) {
  const soldAt = new Date(sale.soldAt);
  return (
    <div id="pos-receipt" className="rcpt">
      <div className="rcpt-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rcpt-logo" src="/komola-logo.png" alt="" />
        <div className="rcpt-wordmark">KOMOLA</div>
        <div className="rcpt-tagline">Organic produce</div>
      </div>

      <div className="rcpt-rule rcpt-rule--solid" />

      <div className="rcpt-store">
        <div className="rcpt-store-name">{orgName || "Organic stall"}</div>
        {locationName ? <div className="rcpt-store-loc">{locationName}</div> : null}
      </div>

      <div className="rcpt-rule" />

      <div className="rcpt-meta">
        <span>Receipt</span>
        <span>{sale.receiptNo}</span>
      </div>
      <div className="rcpt-meta">
        <span>Date</span>
        <span>
          {soldAt.toLocaleDateString("en-IN")}{" "}
          {soldAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {sale.customerPhone ? (
        <div className="rcpt-meta">
          <span>Customer</span>
          <span>{sale.customerPhone}</span>
        </div>
      ) : null}

      <div className="rcpt-rule" />

      <ul className="rcpt-items">
        {sale.items.map((it, i) => (
          <li key={i} className="rcpt-item">
            <div className="rcpt-item-name">{it.name}</div>
            <div className="rcpt-item-calc">
              <span>
                {formatBaseQuantity(it.qtyBase, it.saleUnit as SaleUnit)} ×{" "}
                {formatPaise(it.unitPricePaise)}
              </span>
              <span>{formatPaise(it.netPaise)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="rcpt-rule" />

      <dl className="rcpt-totals">
        <div className="rcpt-total-row">
          <dt>Subtotal</dt>
          <dd>{formatPaise(sale.grossPaise)}</dd>
        </div>
        {sale.discountPaise > 0 ? (
          <div className="rcpt-total-row">
            <dt>Discount</dt>
            <dd>&minus; {formatPaise(sale.discountPaise)}</dd>
          </div>
        ) : null}
        <div className="rcpt-total-row">
          <dt>Tax (incl.)</dt>
          <dd>{formatPaise(sale.taxPaise)}</dd>
        </div>
        <div className="rcpt-total-row rcpt-total-row--grand">
          <dt>TOTAL</dt>
          <dd>{formatPaise(sale.totalPaise)}</dd>
        </div>
      </dl>

      {payments && payments.length > 0 ? (
        <>
          <div className="rcpt-rule" />
          <dl className="rcpt-totals">
            {payments.map((p, i) => (
              <div key={i} className="rcpt-total-row">
                <dt>
                  {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </dt>
                <dd>{formatPaise(p.amountPaise)}</dd>
              </div>
            ))}
            {typeof changePaise === "number" && changePaise > 0 ? (
              <div className="rcpt-total-row">
                <dt>Change</dt>
                <dd>{formatPaise(changePaise)}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}

      <div className="rcpt-rule rcpt-rule--solid" />

      <div className="rcpt-footer">
        <div className="rcpt-thanks">Thank you!</div>
        <div className="rcpt-footer-sub">Keep this receipt for returns &middot; komola.in</div>
        {cashierName ? (
          <div className="rcpt-footer-sub">Served by {cashierName}</div>
        ) : null}
      </div>
    </div>
  );
}
