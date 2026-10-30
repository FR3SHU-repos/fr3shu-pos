"use client";

import toast from "react-hot-toast";
import { CheckCircle2, Coins, MessageCircle, Plus, Printer } from "lucide-react";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { PosTranslator } from "@/shared/components/pos/translator";
import type { PosStore } from "@/shared/hooks/pos/usePosRegister";
import { ReceiptView, type ReceiptPaymentLine } from "@/shared/components/pos/ReceiptView";
import { KomoMessage } from "@/shared/components/mascot";
import { cardCls, ghostBtnCls, primaryBtnCls } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { printReceipt } from "@/shared/lib/offline/receipt-print";
import { buildWhatsAppReceiptUrl } from "@/shared/lib/whatsapp-share";

interface SaleCompletedProps {
  sale: SaleDTO;
  offline: boolean;
  store: PosStore;
  cashierName?: string;
  payment: { lines: ReceiptPaymentLine[]; changePaise: number } | null;
  onNewSale: () => void;
  t: PosTranslator;
}

/** Receipt, rewards summary and next-step actions shown after a sale. */
export function SaleCompleted({
  sale: completed,
  offline: completedOffline,
  store,
  cashierName,
  payment,
  onNewSale,
  t,
}: SaleCompletedProps) {
  const shareOnWhatsApp = () => {
    const url = buildWhatsAppReceiptUrl(completed, { storeName: store.name });
    if (!url) {
      toast.error("Add a valid Indian customer mobile number to share this receipt.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-status-success" />
      <KomoMessage
        action={completedOffline ? "offline" : completed.reward?.linked ? "reward" : "invoice"}
        title={
          completedOffline
            ? "Sale saved safely on this device."
            : completed.reward?.linked
              ? "Your customer earned Komola Coins."
              : "Your receipt is ready."
        }
        description={
          completedOffline
            ? "KOMOLA will sync it when the connection returns."
            : "The sale and receipt are ready for the next customer."
        }
        compact
      />
      <div>
        <h1 className="text-xl font-semibold text-foreground-heading">Purchase completed</h1>
        <p className="text-sm text-foreground-muted">
          {completed.receiptNo} · {formatPaise(completed.totalPaise)} · sync {completed.syncState}
        </p>
        {completedOffline ? (
          <p className="mt-2 rounded-lg bg-status-warning-surface px-3 py-2 text-sm font-medium text-status-warning">
            Saved on this device. Keep this browser data until the sale syncs.
          </p>
        ) : null}
      </div>
      {completed.reward?.linked ? (
        <section className={`${cardCls} text-left`} aria-label="Authoritative purchase rewards">
          <div className="flex items-center gap-2 text-primary">
            <Coins className="h-6 w-6" />
            <h2 className="font-semibold">Komola Coins earned</h2>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Eligible purchase</dt>
              <dd>{formatPaise(completed.reward.eligibleAmountMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Base reward</dt>
              <dd className="font-semibold">+{completed.reward.baseCoins}</dd>
            </div>
            {completed.reward.bonusCoins > 0 ? (
              <div className="flex justify-between">
                <dt>Bonus rewards</dt>
                <dd className="font-semibold">+{completed.reward.bonusCoins}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total earned</dt>
              <dd>+{completed.reward.totalCoins} Komola Coins</dd>
            </div>
          </dl>
          {completed.reward.eligibleRemainderMinor > 0 ? (
            <p className="mt-3 text-xs text-foreground-muted">
              {formatPaise(completed.reward.eligibleRemainderMinor)} carries toward the next coin.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl bg-surface-card p-4 text-sm text-foreground-muted">
          Purchase completed. If this customer later creates or signs in to KOMOLA with this
          verified mobile number, the receipt can appear in their buyer account. Seller-entered
          details do not verify identity or add rewards at checkout.
        </p>
      )}
      <ReceiptView
        sale={completed}
        orgName={store.name}
        locationName={store.location}
        cashierName={cashierName}
        payments={payment?.lines}
        changePaise={payment?.changePaise}
      />
      <div className="flex flex-wrap justify-center gap-2 no-print">
        <button className={primaryBtnCls} onClick={onNewSale}>
          <Plus className="h-4 w-4" />
          {t("pos.new_sale")}
        </button>
        <button className={ghostBtnCls} onClick={() => printReceipt()}>
          <Printer className="h-4 w-4" />
          {t("pos.print_receipt")}
        </button>
        <button className={ghostBtnCls} onClick={shareOnWhatsApp}>
          <MessageCircle className="h-4 w-4" />
          Share via WhatsApp
        </button>
      </div>
    </div>
  );
}
