"use client";

import { Loader2, UserRoundSearch } from "lucide-react";
import { ghostBtnCls, inputCls } from "@/shared/components/ui";
import { BuyerQrScanner } from "@/shared/components/pos/BuyerQrScanner";
import type { PosTranslator } from "@/shared/components/pos/translator";
import type { BuyerLookupApi } from "@/shared/hooks/pos/useBuyerLookup";

interface CustomerBlockProps {
  buyer: BuyerLookupApi;
  t: PosTranslator;
}

/** "Who is buying?": KOMOLA buyer (by code) or walk-in customer details. */
export function CustomerBlock({ buyer, t }: CustomerBlockProps) {
  const { customer, dispatch, findBuyer, attachScannedBuyer } = buyer;
  const {
    guest: guestCustomer,
    resolved: resolvedBuyer,
    buyerCode,
    resolving: resolvingBuyer,
  } = customer;

  return (
    <div className="space-y-3 rounded-3xl bg-surface-muted p-4">
      <p className="text-sm font-semibold text-foreground-heading">Who is buying?</p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Customer type">
        <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl bg-surface-card px-3 py-2 text-sm font-semibold">
          <input
            type="radio"
            name="customer-type"
            checked={!guestCustomer}
            onChange={() => dispatch({ type: "chooseBuyer" })}
          />
          KOMOLA buyer (code)
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl bg-surface-card px-3 py-2 text-sm font-semibold">
          <input
            type="radio"
            name="customer-type"
            checked={guestCustomer}
            onChange={() => dispatch({ type: "chooseGuest" })}
          />
          Walk-in customer
        </label>
      </div>
      {!guestCustomer ? (
        <>
          <div className="flex gap-2">
            <input
              aria-label="Buyer code"
              placeholder="Buyer code · BYR-..."
              value={buyerCode}
              onChange={(e) => dispatch({ type: "typeCode", value: e.target.value.toUpperCase() })}
              className={`${inputCls} !bg-surface-card`}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={findBuyer}
              disabled={resolvingBuyer || !buyerCode.trim()}
              className={`${ghostBtnCls} shrink-0 px-3`}
            >
              {resolvingBuyer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundSearch className="h-4 w-4" />
              )}
              Find
            </button>
            <BuyerQrScanner disabled={resolvingBuyer} onScan={attachScannedBuyer} />
          </div>
          {resolvedBuyer ? (
            <p className="rounded-lg bg-status-success-surface px-3 py-2 text-xs font-medium text-status-success">
              {resolvedBuyer.displayName} is attached. Their receipt and rewards will update when
              the sale is confirmed.
            </p>
          ) : (
            <p className="text-xs text-foreground-muted">
              Enter or scan a valid KOMOLA buyer code. Names and phone numbers cannot verify an
              account.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-2xl bg-status-warning-surface px-3 py-2 text-xs text-status-warning">
          Use this for a customer without a KOMOLA account. The sale is recorded, but the entered
          details will not earn or attach KOMOLA rewards.
        </p>
      )}
      <input
        placeholder={t("pos.customer_name")}
        value={customer.name}
        onChange={(e) => dispatch({ type: "setName", value: e.target.value })}
        className={`${inputCls} !bg-surface-card`}
        autoComplete="off"
        readOnly={!guestCustomer || Boolean(resolvedBuyer)}
        disabled={!guestCustomer && !resolvedBuyer}
      />
      <input
        placeholder={t("pos.customer_phone")}
        value={customer.phone}
        onChange={(e) =>
          dispatch({ type: "setPhone", value: e.target.value.replace(/\D/g, "").slice(0, 10) })
        }
        className={`${inputCls} !bg-surface-card`}
        inputMode="numeric"
        maxLength={10}
        pattern="[6-9][0-9]{9}"
        required
        autoComplete="off"
        readOnly={!guestCustomer || Boolean(resolvedBuyer)}
        disabled={!guestCustomer && !resolvedBuyer}
      />
      <label className="flex items-center gap-2 text-xs text-foreground-muted">
        <input
          type="checkbox"
          checked={customer.marketingConsent}
          onChange={(e) => dispatch({ type: "setConsent", value: e.target.checked })}
        />
        Customer consents to marketing messages
      </label>
    </div>
  );
}
