import type { ResolvedBuyer } from "@/shared/lib/api/customers";

export interface CustomerState {
  name: string;
  phone: string;
  buyerCode: string;
  resolved: ResolvedBuyer | null;
  /** True = walk-in customer, false = KOMOLA buyer identified by code. */
  guest: boolean;
  resolving: boolean;
  marketingConsent: boolean;
}

export const initialCustomerState: CustomerState = {
  name: "",
  phone: "",
  buyerCode: "",
  resolved: null,
  guest: true,
  resolving: false,
  marketingConsent: false,
};

export type CustomerAction =
  | { type: "reset" }
  | { type: "setName"; value: string }
  | { type: "setPhone"; value: string }
  | { type: "setConsent"; value: boolean }
  /** Typing in the buyer-code box invalidates any previous match. */
  | { type: "typeCode"; value: string }
  | { type: "chooseBuyer" }
  | { type: "chooseGuest" }
  | { type: "scanned"; code: string }
  | { type: "resolveStart" }
  | { type: "resolveFailed" }
  | { type: "resolved"; buyer: ResolvedBuyer };

export function customerReducer(state: CustomerState, action: CustomerAction): CustomerState {
  switch (action.type) {
    case "reset":
      return initialCustomerState;
    case "setName":
      return { ...state, name: action.value };
    case "setPhone":
      return { ...state, phone: action.value };
    case "setConsent":
      return { ...state, marketingConsent: action.value };
    case "typeCode":
      return { ...state, buyerCode: action.value, resolved: null };
    case "chooseBuyer":
      return { ...state, guest: false, name: "", phone: "" };
    case "chooseGuest":
      return { ...state, guest: true, buyerCode: "", resolved: null, name: "", phone: "" };
    case "scanned":
      return { ...state, buyerCode: action.code, resolved: null };
    case "resolveStart":
      return { ...state, resolving: true };
    case "resolveFailed":
      return { ...state, resolving: false, resolved: null };
    case "resolved":
      return {
        ...state,
        resolving: false,
        buyerCode: action.buyer.code,
        resolved: action.buyer,
        guest: false,
        name: action.buyer.displayName,
        phone: action.buyer.phone,
      };
  }
}
