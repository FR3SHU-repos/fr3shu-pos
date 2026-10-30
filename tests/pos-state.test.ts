import { describe, expect, it } from "vitest";
import { initialPaymentState, paymentReducer, qrAmountFor } from "@/shared/lib/pos/payment-state";
import { customerReducer, initialCustomerState } from "@/shared/lib/pos/customer-state";
import type { ResolvedBuyer } from "@/shared/lib/api/customers";

describe("paymentReducer", () => {
  it("prefills every amount with the cart total on start, keeping the chosen method", () => {
    const s = paymentReducer(
      { ...initialPaymentState, method: "upi" },
      { type: "start", netPaise: 12345 },
    );
    expect(s).toMatchObject({
      method: "upi",
      tendered: "123.45",
      cashPart: "123.45",
      upiPart: "0",
      upiAmount: "123.45",
    });
  });

  it("fills tendered only when switching to cash with an empty amount", () => {
    const empty = paymentReducer(initialPaymentState, {
      type: "method",
      method: "cash",
      netPaise: 5000,
    });
    expect(empty.tendered).toBe("50.00");
    const filled = paymentReducer(
      { ...initialPaymentState, tendered: "70.00" },
      { type: "method", method: "cash", netPaise: 5000 },
    );
    expect(filled.tendered).toBe("70.00");
    const upi = paymentReducer(initialPaymentState, {
      type: "method",
      method: "upi",
      netPaise: 5000,
    });
    expect(upi.tendered).toBe("");
    expect(upi.method).toBe("upi");
  });

  it("adds cash chips on top of the tendered amount", () => {
    let s = paymentReducer(initialPaymentState, { type: "start", netPaise: 4750 });
    s = paymentReducer(s, { type: "addCash", rupees: 10 });
    expect(s.tendered).toBe("57.50");
    s = paymentReducer(s, { type: "exactCash", netPaise: 4750 });
    expect(s.tendered).toBe("47.50");
  });

  it("resets to the initial state", () => {
    const s = paymentReducer(
      { ...initialPaymentState, method: "split", upiRef: "x" },
      { type: "reset" },
    );
    expect(s).toEqual(initialPaymentState);
  });

  it("derives the QR amount from the UPI part for split and the UPI amount otherwise", () => {
    expect(
      qrAmountFor({ ...initialPaymentState, method: "split", upiPart: "20.5", upiAmount: "99" }),
    ).toBe(2050);
    expect(
      qrAmountFor({ ...initialPaymentState, method: "upi", upiPart: "20.5", upiAmount: "99" }),
    ).toBe(9900);
    expect(qrAmountFor(initialPaymentState)).toBe(0);
  });
});

const buyer = { code: "BYR-1A2B3C4D5E", displayName: "Asha", phone: "9123456780" } as ResolvedBuyer;

describe("customerReducer", () => {
  it("starts as a walk-in customer", () => {
    expect(initialCustomerState.guest).toBe(true);
  });

  it("attaches a resolved buyer and locks identity fields from the API", () => {
    let s = customerReducer(initialCustomerState, { type: "chooseBuyer" });
    s = customerReducer(s, { type: "resolveStart" });
    expect(s.resolving).toBe(true);
    s = customerReducer(s, { type: "resolved", buyer });
    expect(s).toMatchObject({
      guest: false,
      resolving: false,
      name: "Asha",
      phone: "9123456780",
      buyerCode: buyer.code,
    });
    expect(s.resolved).toBe(buyer);
  });

  it("clears the match when the code is edited or lookup fails", () => {
    const attached = customerReducer(
      customerReducer(initialCustomerState, { type: "chooseBuyer" }),
      { type: "resolved", buyer },
    );
    expect(customerReducer(attached, { type: "typeCode", value: "BYR-" }).resolved).toBeNull();
    expect(
      customerReducer({ ...attached, resolving: true }, { type: "resolveFailed" }),
    ).toMatchObject({ resolving: false, resolved: null });
  });

  it("switching to walk-in drops the buyer, code and details", () => {
    const attached = customerReducer(initialCustomerState, { type: "resolved", buyer });
    const guest = customerReducer(attached, { type: "chooseGuest" });
    expect(guest).toMatchObject({
      guest: true,
      buyerCode: "",
      resolved: null,
      name: "",
      phone: "",
    });
  });

  it("keeps the marketing consent across identity switches but clears on reset", () => {
    let s = customerReducer(initialCustomerState, { type: "setConsent", value: true });
    s = customerReducer(s, { type: "chooseBuyer" });
    expect(s.marketingConsent).toBe(true);
    expect(customerReducer(s, { type: "reset" })).toEqual(initialCustomerState);
  });
});
