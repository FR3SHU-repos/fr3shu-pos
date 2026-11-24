"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { receiptsApi } from "@/shared/lib/api";
import { useApi } from "@/shared/hooks/useApi";
import { formatPaise } from "@/shared/lib/money";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import type { ReceiptIssueReason } from "@/shared/lib/api/receipts";
import { downloadBuyerReceiptPdf } from "@/shared/lib/receipt-pdf";
import { printReceipt } from "@/shared/lib/offline/receipt-print";

export default function BuyerReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: receipt,
    error,
    mutate,
  } = useApi(() => receiptsApi.get(id), [id], { keepData: false });
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReceiptIssueReason>("wrong_amount");
  const [note, setNote] = useState("");
  const [reportError, setReportError] = useState("");
  const [busy, setBusy] = useState(false);

  if (error)
    return (
      <main className="mx-auto max-w-2xl p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
        <p role="alert" className="rounded-xl bg-status-danger-surface p-4 text-status-danger">
          {error}
        </p>
      </main>
    );
  if (!receipt)
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </main>
    );

  async function download() {
    if (!receipt) return;
    await downloadBuyerReceiptPdf(receipt);
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/buyer/receipts" className={ghostBtnCls}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex gap-2">
          <button type="button" onClick={() => void download()} className={ghostBtnCls}>
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button type="button" onClick={() => printReceipt()} className={primaryBtnCls}>
            <Printer className="h-4 w-4" />
            Print / save PDF
          </button>
        </div>
      </div>
      <article id="pos-receipt">
        <div className="rcpt-brand">
          <Image className="rcpt-logo" src="/komola-logo.png" width={52} height={52} alt="" />
          <div className="rcpt-wordmark">KOMOLA</div>
          <div className="rcpt-tagline">E-receipt</div>
        </div>
        <div className="rcpt-rule rcpt-rule--solid" />
        <div className="rcpt-store">
          <div className="rcpt-store-name">{receipt.storeName}</div>
          <div className="rcpt-store-loc">{receipt.locationName}</div>
        </div>
        <div className="rcpt-rule" />
        <div className="rcpt-meta">
          <span>Receipt</span>
          <span>{receipt.receiptNo}</span>
        </div>
        <div className="rcpt-meta">
          <span>Date</span>
          <span>{new Date(receipt.purchasedAt).toLocaleString("en-IN")}</span>
        </div>
        <div className="rcpt-rule" />
        <ul className="rcpt-items">
          {receipt.lines.map((line, index) => (
            <li className="rcpt-item" key={index}>
              <div className="rcpt-item-name">{line.name}</div>
              <div className="rcpt-item-calc">
                <span>
                  {formatBaseQuantity(Number(line.quantity), line.unit as SaleUnit)} ×{" "}
                  {formatPaise(line.unitPriceMinor)}
                </span>
                <span>{formatPaise(line.totalMinor)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="rcpt-rule" />
        <dl className="rcpt-totals">
          <div className="rcpt-total-row">
            <dt>Subtotal</dt>
            <dd>{formatPaise(receipt.subtotalMinor)}</dd>
          </div>
          {receipt.discountMinor > 0 ? (
            <div className="rcpt-total-row">
              <dt>Discount</dt>
              <dd>− {formatPaise(receipt.discountMinor)}</dd>
            </div>
          ) : null}
          <div className="rcpt-total-row">
            <dt>Tax (incl.)</dt>
            <dd>{formatPaise(receipt.taxMinor)}</dd>
          </div>
          <div className="rcpt-total-row rcpt-total-row--grand">
            <dt>TOTAL</dt>
            <dd>{formatPaise(receipt.totalMinor)}</dd>
          </div>
        </dl>
        <div className="rcpt-rule rcpt-rule--solid" />
        <div className="rcpt-footer">
          <div className="rcpt-thanks">
            {receipt.coinsEarned} Komola Coin{receipt.coinsEarned === 1 ? "" : "s"} earned
          </div>
          <div className="rcpt-footer-sub">Completed KOMOLA purchase</div>
        </div>
      </article>
      <section className={cardCls + " no-print mt-5 space-y-3"}>
        <h2 className="font-semibold">Receipt help</h2>
        {receipt.issue ? (
          <p role="status">Reported issue · {receipt.issue.status}</p>
        ) : reporting ? (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setReportError("");
              const result = await receiptsApi.reportIssue(id, reason, note);
              setBusy(false);
              if (result.success && result.data) {
                mutate({ ...receipt, issue: result.data });
                setReporting(false);
              } else setReportError(result.message);
            }}
          >
            <label className="block">
              Reason
              <select
                className={inputCls}
                value={reason}
                onChange={(event) => setReason(event.target.value as ReceiptIssueReason)}
              >
                <option value="wrong_amount">Wrong amount</option>
                <option value="items_wrong">Incorrect items</option>
                <option value="not_my_bill">This isn’t my receipt</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              Details (optional)
              <textarea
                className={inputCls}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {reportError ? <p role="alert">{reportError}</p> : null}
            <button className={primaryBtnCls} disabled={busy}>
              Submit report
            </button>{" "}
            <button
              type="button"
              className={ghostBtnCls}
              disabled={busy}
              onClick={() => setReporting(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button className={ghostBtnCls} onClick={() => setReporting(true)}>
            Report a problem
          </button>
        )}
      </section>
    </main>
  );
}
