"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { receiptsApi } from "@/shared/lib/api";
import type { BuyerReceiptDetail } from "@/shared/lib/api/receipts";
import { formatPaise } from "@/shared/lib/money";
import { ghostBtnCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";
import { downloadBuyerReceiptPdf } from "@/shared/lib/receipt-pdf";

export default function BuyerReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<BuyerReceiptDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void receiptsApi.get(id).then((result) => result.success && result.data ? setReceipt(result.data) : setError(result.message)); }, [id]);

  if (error) return <main className="mx-auto max-w-2xl p-4 sm:p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p></main>;
  if (!receipt) return <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8"><Skeleton className="h-12 w-64"/><Skeleton className="h-96 w-full"/></main>;

  async function download() {
    if (!receipt) return;
    await downloadBuyerReceiptPdf(receipt);
  }

  return <main className="mx-auto max-w-2xl p-4 sm:p-8"><div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/buyer" className={ghostBtnCls}><ArrowLeft className="h-4 w-4"/>Back</Link><div className="flex gap-2"><button type="button" onClick={()=>void download()} className={ghostBtnCls}><Download className="h-4 w-4"/>Download PDF</button><button type="button" onClick={()=>window.print()} className={primaryBtnCls}><Printer className="h-4 w-4"/>Print / save PDF</button></div></div><article id="pos-receipt"><div className="rcpt-brand"><Image className="rcpt-logo" src="/komola-logo.png" width={52} height={52} alt=""/><div className="rcpt-wordmark">KOMOLA</div><div className="rcpt-tagline">E-receipt</div></div><div className="rcpt-rule rcpt-rule--solid"/><div className="rcpt-store"><div className="rcpt-store-name">{receipt.storeName}</div><div className="rcpt-store-loc">{receipt.locationName}</div></div><div className="rcpt-rule"/><div className="rcpt-meta"><span>Receipt</span><span>{receipt.receiptNo}</span></div><div className="rcpt-meta"><span>Date</span><span>{new Date(receipt.purchasedAt).toLocaleString("en-IN")}</span></div><div className="rcpt-rule"/><ul className="rcpt-items">{receipt.lines.map((line,index)=><li className="rcpt-item" key={index}><div className="rcpt-item-name">{line.name}</div><div className="rcpt-item-calc"><span>{line.quantity} {line.unit} × {formatPaise(line.unitPriceMinor)}</span><span>{formatPaise(line.totalMinor)}</span></div></li>)}</ul><div className="rcpt-rule"/><dl className="rcpt-totals"><div className="rcpt-total-row"><dt>Subtotal</dt><dd>{formatPaise(receipt.subtotalMinor)}</dd></div>{receipt.discountMinor>0?<div className="rcpt-total-row"><dt>Discount</dt><dd>− {formatPaise(receipt.discountMinor)}</dd></div>:null}<div className="rcpt-total-row"><dt>Tax (incl.)</dt><dd>{formatPaise(receipt.taxMinor)}</dd></div><div className="rcpt-total-row rcpt-total-row--grand"><dt>TOTAL</dt><dd>{formatPaise(receipt.totalMinor)}</dd></div></dl><div className="rcpt-rule rcpt-rule--solid"/><div className="rcpt-footer"><div className="rcpt-thanks">{receipt.coinsEarned} Komola Coin{receipt.coinsEarned===1?"":"s"} earned</div><div className="rcpt-footer-sub">Completed KOMOLA purchase</div></div></article></main>;
}
