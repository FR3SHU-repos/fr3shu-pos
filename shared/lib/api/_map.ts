/**
 * Shape adapters between the canonical Go POS API and the DTOs the POS UI was
 * built against. The UI is unchanged; only these mappers moved.
 */
import type { SaleUnit, BaseUnit } from "@/shared/lib/units";

const UNIT_FACTOR: Record<string, number> = {
  kg: 1000,
  g: 1,
  l: 1000,
  litre: 1000,
  ml: 1,
  piece: 1,
  bunch: 1,
  pack: 1,
  packet: 1,
  dozen: 1,
};

const UNIT_BASE: Record<string, BaseUnit> = {
  kg: "g",
  g: "g",
  l: "ml",
  litre: "ml",
  ml: "ml",
  piece: "count",
  bunch: "count",
  pack: "count",
  packet: "count",
  dozen: "count",
};

export const unitFactor = (unit: string): number => UNIT_FACTOR[unit?.toLowerCase()] ?? 1;
export const unitBase = (unit: string): BaseUnit => UNIT_BASE[unit?.toLowerCase()] ?? "count";

/** Go POS product read DTO (see internal/modules/pos/service_catalogue.go). */
export interface GoProduct {
  skuId: string;
  productId: string;
  variantId: string;
  skuCode: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  packQuantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
  availableQty: string;
  available: boolean;
  lots: Array<{ lotId?: string; lotCode?: string; qty: string; expiresAt?: string }>;
  status: string;
}

export type OrganicStatus =
  | "Verified"
  | "InConversion"
  | "PendingVerification"
  | "Expired"
  | "Rejected"
  | "NotOrganic";

export type ProductStatus = "active" | "inactive" | "archived";

export interface ProductDTO {
  _id: string;
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  saleUnit: SaleUnit;
  baseUnit: BaseUnit;
  basePerSaleUnit: number;
  basePricePaise?: number;
  taxRateBps: number;
  categoryId?: string;
  category?: string;
  description?: string;
  organicStatus: OrganicStatus;
  status: ProductStatus;
  isPinned: boolean;
  availableBase: number;
}

export function mapProduct(p: GoProduct): ProductDTO {
  return {
    _id: p.skuId,
    id: p.skuId,
    name: p.name || p.skuCode,
    sku: p.skuCode,
    barcode: p.barcode || undefined,
    saleUnit: (p.unit || "piece") as SaleUnit,
    baseUnit: unitBase(p.unit),
    basePerSaleUnit: unitFactor(p.unit),
    basePricePaise: p.unitPriceMinor || undefined,
    taxRateBps: p.taxRateBps ?? 0,
    category: p.category || undefined,
    organicStatus: "PendingVerification",
    status: (["active", "inactive", "archived"].includes(p.status) ? p.status : "active") as ProductStatus,
    // The POS quick-pick grid keys off `isPinned`; use in-stock as the stand-in
    // since the canonical catalogue does not carry a POS pin flag.
    isPinned: !!p.available,
    availableBase: Math.round(Number(p.availableQty || 0) * unitFactor(p.unit)),
  };
}

/** Go shift DTO (see internal/modules/pos/service.go shiftDTO). */
export interface GoShift {
  id: string;
  registerId: string;
  operatorId: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string | null;
  openingCashMinor: number;
  expectedCashMinor: number;
  countedCashMinor: number;
  varianceMinor: number;
  note?: string;
  totals: {
    saleCount: number;
    grossMinor: number;
    discountMinor: number;
    taxMinor: number;
    netMinor: number;
    cashCapturedMinor: number;
    cashRefundMinor: number;
    refundMinor: number;
  };
  tenderBreakdown: Record<string, number>;
}

export interface SessionTotals {
  cashSalesPaise: number;
  upiSalesPaise: number;
  cardSalesPaise: number;
  refundsPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  saleCount: number;
}

export interface SessionDTO {
  _id: string;
  registerId: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openingCashPaise: number;
  expectedCashPaise: number;
  countedCashPaise: number;
  cashVariancePaise: number;
  varianceNote?: string;
  totals: SessionTotals;
}

export function mapShift(s: GoShift): SessionDTO {
  const tb = s.tenderBreakdown || {};
  return {
    _id: s.id,
    registerId: s.registerId,
    status: s.status,
    openedAt: s.openedAt,
    closedAt: s.closedAt ?? null,
    openingCashPaise: s.openingCashMinor,
    expectedCashPaise: s.expectedCashMinor,
    countedCashPaise: s.countedCashMinor,
    cashVariancePaise: s.varianceMinor,
    varianceNote: s.note || undefined,
    totals: {
      cashSalesPaise: tb.cash ?? 0,
      // UPI/card now flow through the provider-neutral "manual" tender.
      upiSalesPaise: tb.manual ?? 0,
      cardSalesPaise: tb.test ?? 0,
      refundsPaise: s.totals?.refundMinor ?? 0,
      cashInPaise: 0,
      cashOutPaise: 0,
      saleCount: s.totals?.saleCount ?? 0,
    },
  };
}

/** Go register list row. */
export interface GoRegisterRow {
  register: {
    id: string;
    code: string;
    name: string;
    status: string;
    sellingLocationId: string;
    currentShiftId?: string;
  };
  currentShift?: GoShift;
}

export interface RegisterDTO {
  _id: string;
  code: string;
  name: string;
  status: string;
  locationId: string;
}

export const mapRegister = (r: GoRegisterRow["register"]): RegisterDTO => ({
  _id: r.id,
  code: r.code,
  name: r.name,
  status: r.status,
  locationId: r.sellingLocationId,
});

/** Go sale DTO (see internal/modules/pos/service.go saleDTO). */
export interface GoSaleLine {
  lineNo: number;
  skuId: string;
  skuCode: string;
  barcode?: string;
  name: string;
  unit: string;
  qty: string;
  unitPriceMinor: number;
  grossMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  netMinor: number;
  returnedQty: string;
  allocations: Array<{ lotId?: string; qty: string }>;
}

export interface GoSale {
  id: string;
  receiptNo: string;
  status: string;
  registerId: string;
  shiftId: string;
  operatorId: string;
  sellingLocationId: string;
  lines: GoSaleLine[];
  subtotalMinor: number;
  lineDiscountMinor: number;
  cartDiscountMinor: number;
  taxMinor: number;
  totalMinor: number;
  tenderedMinor: number;
  changeMinor: number;
  paymentState: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
}

export interface SaleItemDTO {
  productId: string;
  lotId: string;
  name: string;
  sku: string;
  barcode?: string;
  saleUnit: SaleUnit;
  qtyBase: number;
  basePerSaleUnit: number;
  unitPricePaise: number;
  grossPaise: number;
  discountPaise: number;
  taxRateBps: number;
  taxPaise: number;
  netPaise: number;
  organic: { isVerifiedOrganic: boolean };
}

export interface SaleDTO {
  _id: string;
  receiptNo: string;
  status: string;
  items: SaleItemDTO[];
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  customerName?: string;
  customerPhone?: string;
  cashierId: string;
  registerId: string;
  sessionId: string;
  locationId: string;
  soldAt: string;
  syncState: "synced";
  idempotencyKey: string;
  paymentState: string;
}

function mapLine(l: GoSaleLine): SaleItemDTO {
  return {
    productId: l.skuId,
    lotId: l.allocations?.[0]?.lotId ?? "",
    name: l.name,
    sku: l.skuCode,
    barcode: l.barcode || undefined,
    saleUnit: (l.unit || "piece") as SaleUnit,
    // Go returns the quantity already in canonical base units.
    qtyBase: Math.round(Number(l.qty || 0)),
    basePerSaleUnit: unitFactor(l.unit),
    unitPricePaise: l.unitPriceMinor,
    grossPaise: l.grossMinor,
    discountPaise: l.discountMinor,
    taxRateBps: l.taxRateBps,
    taxPaise: l.taxMinor,
    netPaise: l.netMinor,
    organic: { isVerifiedOrganic: false },
  };
}

export function mapSale(s: GoSale): SaleDTO {
  return {
    _id: s.id,
    receiptNo: s.receiptNo,
    status: s.status,
    items: (s.lines ?? []).map(mapLine),
    grossPaise: s.subtotalMinor,
    discountPaise: s.lineDiscountMinor + s.cartDiscountMinor,
    taxPaise: s.taxMinor,
    totalPaise: s.totalMinor,
    customerName: s.customerName || undefined,
    customerPhone: s.customerPhone || undefined,
    cashierId: s.operatorId,
    registerId: s.registerId,
    sessionId: s.shiftId,
    locationId: s.sellingLocationId,
    soldAt: s.createdAt,
    syncState: "synced",
    idempotencyKey: "",
    paymentState: s.paymentState,
  };
}

export interface GoTender {
  id: string;
  kind: string;
  direction: "capture" | "refund";
  amountMinor: number;
  reference?: string;
  reason?: string;
}

export interface PaymentDTO {
  _id: string;
  method: string;
  amountPaise: number;
  upiRef?: string;
  direction: "capture" | "refund";
}

export const mapTender = (t: GoTender): PaymentDTO => ({
  _id: t.id,
  method: t.kind === "cash" ? "cash" : t.reason || t.kind,
  amountPaise: t.amountMinor,
  upiRef: t.reference || undefined,
  direction: t.direction,
});
