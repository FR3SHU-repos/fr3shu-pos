"use client";

import { useCallback, useReducer } from "react";
import toast from "react-hot-toast";
import { customersApi } from "@/shared/lib/api";
import { customerReducer, initialCustomerState } from "@/shared/lib/pos/customer-state";

/** Customer identity for the sale: walk-in details or a KOMOLA buyer resolved by code. */
export function useBuyerLookup() {
  const [customer, dispatch] = useReducer(customerReducer, initialCustomerState);

  const resolveBuyer = useCallback(async (value: string) => {
    const code = value.trim().toUpperCase();
    if (!/^BYR-[A-F0-9]{10}$/.test(code)) {
      toast.error("Enter a buyer code like BYR-1A2B3C4D5E");
      return;
    }
    dispatch({ type: "resolveStart" });
    const result = await customersApi.resolveBuyerCode(code);
    if (!result.success || !result.data) {
      dispatch({ type: "resolveFailed" });
      toast.error(result.status === 404 ? "Buyer code not found" : result.message);
      return;
    }
    dispatch({ type: "resolved", buyer: result.data });
    toast.success("Buyer attached to this sale");
  }, []);

  const attachScannedBuyer = useCallback(
    (code: string) => {
      dispatch({ type: "scanned", code });
      void resolveBuyer(code);
    },
    [resolveBuyer],
  );

  return {
    customer,
    dispatch,
    resolveBuyer,
    findBuyer: () => void resolveBuyer(customer.buyerCode),
    attachScannedBuyer,
    reset: () => dispatch({ type: "reset" }),
  };
}

export type BuyerLookupApi = ReturnType<typeof useBuyerLookup>;
