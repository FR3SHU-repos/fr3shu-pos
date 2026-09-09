import { describe, expect, it } from "vitest";
import { mapSale, type GoSale } from "@/shared/lib/api/_map";

describe("authoritative checkout rewards", () => {
  it("passes the backend reward result to the confirmation UI unchanged", () => {
    const reward = { linked: true, status: "available" as const, eligibleAmountMinor: 78000, baseCoins: 7, bonusCoins: 0, totalCoins: 7, eligibleRemainderMinor: 8000, reason: "Verified farm-produce purchase" };
    const sale: GoSale = { id:"sale",receiptNo:"POS-1",status:"completed",registerId:"r",shiftId:"s",operatorId:"o",sellingLocationId:"l",lines:[],subtotalMinor:78000,lineDiscountMinor:0,cartDiscountMinor:0,taxMinor:0,totalMinor:78000,tenderedMinor:78000,changeMinor:0,paymentState:"paid",createdAt:"2026-09-09T00:00:00Z",reward };
    expect(mapSale(sale).reward).toEqual(reward);
  });
});
