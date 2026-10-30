"use client";

import { useMemo, useReducer, useRef, useState, type Dispatch, type SetStateAction } from "react";
import toast from "react-hot-toast";
import { salesApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { CartLine } from "@/shared/components/pos/types";
import type { ReceiptPaymentLine } from "@/shared/components/pos/ReceiptView";
import type { CustomerState } from "@/shared/lib/pos/customer-state";
import type { PosStore } from "@/shared/hooks/pos/usePosRegister";
import { initialPaymentState, paymentReducer, qrAmountFor } from "@/shared/lib/pos/payment-state";
import { lineBasePerSaleUnit, lineBaseUnit, lineUnitPricePaise } from "@/shared/lib/pos/cart-lines";
import { formatPaise } from "@/shared/lib/money";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import { buildUpiPaymentUri, isValidUpiId } from "@/shared/lib/upi";
import { newUuid } from "@/shared/lib/uuid";
import {
  commitOfflineCashSale,
  offlineSaleToDTO,
  parseRupeesToPaise,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

interface Options {
  lines: CartLine[];
  netPaise: number;
  customer: CustomerState;
  store: PosStore;
  session: SessionDTO | null;
  offlineScope: OfflineScope | null;
  cashierId: string;
  setCatalog: Dispatch<SetStateAction<ProductDTO[]>>;
  refreshPendingOfflineCount: () => Promise<void>;
  /** Re-fetch register + catalogue after an online sale. */
  reload: () => Promise<void>;
}

/** Payment entry state, the checkout flow and the completed-sale result. */
export function useCheckout({
  lines,
  netPaise,
  customer,
  store,
  session,
  offlineScope,
  cashierId,
  setCatalog,
  refreshPendingOfflineCount,
  reload,
}: Options) {
  const [payment, dispatch] = useReducer(paymentReducer, initialPaymentState);
  const [showPay, setShowPay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<SaleDTO | null>(null);
  const [completedOffline, setCompletedOffline] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<{
    lines: ReceiptPaymentLine[];
    changePaise: number;
  } | null>(null);
  // One idempotency key per cart attempt. Regenerated after a completed sale.
  const idemRef = useRef<string>(newUuid());

  const qrAmountPaise = qrAmountFor(payment);
  const upiPaymentUri = useMemo(() => {
    if (!store.upiId || !isValidUpiId(store.upiId) || qrAmountPaise <= 0) return null;
    return buildUpiPaymentUri({
      upiId: store.upiId,
      payeeName: store.upiPayeeName || store.name || store.upiId,
      amountPaise: qrAmountPaise,
      note: "KOMOLA POS payment",
    });
  }, [qrAmountPaise, store]);

  function startPay() {
    if (lines.length === 0) return;
    setShowPay(true);
    dispatch({ type: "start", netPaise });
  }

  /** Clears payment state and the idempotency key; the cart/customer hooks reset themselves. */
  function reset() {
    setShowPay(false);
    dispatch({ type: "reset" });
    setCompletedPayment(null);
    setCompletedOffline(false);
    idemRef.current = newUuid();
  }

  async function completeSale() {
    if (submitting || lines.length === 0) return;
    const { name: customerName, phone: customerPhone, guest: guestCustomer, resolved: resolvedBuyer, marketingConsent } = customer;
    const payMethod = payment.method;
    if (!customerName.trim()) {
      toast.error("Enter the customer's name");
      return;
    }
    if (!normalizeIndianMobile(customerPhone)) {
      toast.error("Enter a valid 10-digit Indian customer mobile number.");
      return;
    }
    if (!guestCustomer && !resolvedBuyer) {
      toast.error("Find or scan a valid KOMOLA buyer code, or choose guest customer");
      return;
    }

    const cashReceivedPaise = payMethod === "cash" ? parseRupeesToPaise(payment.tendered) : null;
    if (payMethod === "cash" && cashReceivedPaise == null) {
      toast.error("Enter a valid cash amount.");
      return;
    }

    const payments: { method: "cash" | "upi"; amountPaise: number; upiRef?: string }[] = [];
    if (payMethod === "cash") {
      if (cashReceivedPaise == null || cashReceivedPaise < netPaise) {
        toast.error("Cash received is less than the sale total.");
        return;
      }
      payments.push({ method: "cash", amountPaise: cashReceivedPaise });
    } else if (payMethod === "upi") {
      const upi = parseRupeesToPaise(payment.upiAmount);
      if (upi == null || upi !== netPaise) {
        toast.error(`UPI amount must equal ${formatPaise(netPaise)}`);
        return;
      }
      if (!store.upiId) {
        toast.error("Add the seller UPI ID in Payment settings first.");
        return;
      }
      payments.push({ method: "upi", amountPaise: upi, upiRef: payment.upiRef.trim() || undefined });
    } else {
      const cash = Math.round(Number(payment.cashPart || 0) * 100);
      const upi = Math.round(Number(payment.upiPart || 0) * 100);
      if (cash + upi !== netPaise) {
        toast.error(`Split must total ${formatPaise(netPaise)}`);
        return;
      }
      if (upi > 0 && !store.upiId) {
        toast.error("Add the seller UPI ID in Payment settings first.");
        return;
      }
      if (cash > 0) payments.push({ method: "cash", amountPaise: cash });
      if (upi > 0) payments.push({ method: "upi", amountPaise: upi, upiRef: payment.upiRef.trim() || undefined });
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (payMethod !== "cash") {
        toast.error("Offline checkout is available for cash sales only.");
        return;
      }
      if (!offlineScope || !session || cashReceivedPaise == null) {
        toast.error("This register is not ready for offline checkout.");
        return;
      }
      setSubmitting(true);
      try {
        const sale = await commitOfflineCashSale({
          scope: offlineScope,
          session,
          cashierId,
          lines,
          cashReceivedPaise,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          buyerCode: resolvedBuyer?.code,
          marketingConsent: marketingConsent || undefined,
          operationId: idemRef.current,
        });
        setCatalog((prev) =>
          prev.map((product) => {
            const soldBase = sale.lines
              .filter((line) => line.productId === product._id)
              .reduce((sum, line) => sum + line.qtyBase, 0);
            return soldBase > 0 ? { ...product, availableBase: Math.max(0, product.availableBase - soldBase) } : product;
          }),
        );
        setCompletedPayment({
          lines: [{ method: "Cash", amountPaise: sale.payment.receivedPaise }],
          changePaise: sale.payment.changePaise,
        });
        setCompleted(offlineSaleToDTO(sale));
        setCompletedOffline(true);
        await refreshPendingOfflineCount();
        void refreshPendingOfflineCount();
        toast.success("Sale saved on this device. It will sync when internet returns.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Offline sale failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    const res = await salesApi.create({
      idempotencyKey: idemRef.current,
      // The displayed session may come from the offline cache after a reset or
      // while the register endpoint is unavailable. Online checkout resolves
      // the current server-side open register instead of reusing that stale ID.
      items: lines.map((l) => ({
        productId: l.product._id,
        qty: l.qty,
        saleUnit: l.saleUnit,
        baseUnit: lineBaseUnit(l),
        basePerSaleUnit: lineBasePerSaleUnit(l),
        unitPricePaise: lineUnitPricePaise(l),
        priceOverridden: l.priceOverridden,
        discountPaise: l.discountPaise || undefined,
      })),
      payments,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      buyerCode: resolvedBuyer?.code,
      walkInCustomer: guestCustomer,
      marketingConsent: marketingConsent || undefined,
    });
    setSubmitting(false);

    if (!res.success || !res.data) {
      toast.error(res.message || "Sale failed");
      return;
    }
    const label: Record<"cash" | "upi", string> = { cash: "Cash", upi: "UPI" };
    setCompletedPayment({
      lines: payments.map((p) => ({
        method: label[p.method],
        amountPaise: p.amountPaise,
        reference: p.upiRef,
      })),
      changePaise:
        payMethod === "cash"
          ? Math.max(0, (cashReceivedPaise ?? netPaise) - netPaise)
          : 0,
    });
    setCompleted(res.data.sale);
    setCompletedOffline(false);
    void reload();
  }

  return {
    payment,
    dispatch,
    showPay,
    setShowPay,
    submitting,
    completed,
    setCompleted,
    completedOffline,
    completedPayment,
    qrAmountPaise,
    upiPaymentUri,
    startPay,
    completeSale,
    reset,
  };
}

export type CheckoutApi = ReturnType<typeof useCheckout>;
