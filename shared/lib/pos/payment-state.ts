export type PayMethod = "cash" | "upi" | "split";

export interface PaymentState {
  method: PayMethod;
  cashPart: string;
  upiPart: string;
  upiAmount: string;
  upiRef: string;
  tendered: string;
}

export const initialPaymentState: PaymentState = {
  method: "cash",
  cashPart: "",
  upiPart: "",
  upiAmount: "",
  upiRef: "",
  tendered: "",
};

export type PaymentAction =
  | { type: "reset" }
  /** Open checkout: prefill every amount with the cart total. */
  | { type: "start"; netPaise: number }
  | { type: "method"; method: PayMethod; netPaise: number }
  | { type: "set"; field: Exclude<keyof PaymentState, "method">; value: string }
  | { type: "addCash"; rupees: number }
  | { type: "exactCash"; netPaise: number };

const rupees2 = (paise: number) => (paise / 100).toFixed(2);

export function paymentReducer(state: PaymentState, action: PaymentAction): PaymentState {
  switch (action.type) {
    case "reset":
      return initialPaymentState;
    case "start":
      return {
        ...state,
        tendered: rupees2(action.netPaise),
        cashPart: rupees2(action.netPaise),
        upiPart: "0",
        upiAmount: rupees2(action.netPaise),
      };
    case "method":
      return {
        ...state,
        method: action.method,
        tendered:
          action.method === "cash" && !state.tendered ? rupees2(action.netPaise) : state.tendered,
      };
    case "set":
      return { ...state, [action.field]: action.value };
    case "addCash": {
      const current = Math.round(Number(state.tendered || 0) * 100);
      return { ...state, tendered: ((current + action.rupees * 100) / 100).toFixed(2) };
    }
    case "exactCash":
      return { ...state, tendered: rupees2(action.netPaise) };
  }
}

/** Amount (paise) shown in the UPI QR for the current method. */
export function qrAmountFor(state: PaymentState): number {
  return state.method === "split"
    ? Math.round(Number(state.upiPart || 0) * 100)
    : Math.round(Number(state.upiAmount || 0) * 100);
}
