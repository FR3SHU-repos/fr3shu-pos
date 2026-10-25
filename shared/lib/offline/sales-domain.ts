import type { ProductDTO } from "@/shared/lib/api/products";
import { newUuid } from "@/shared/lib/uuid";
import type { CartLine } from "@/shared/components/pos/types";
import { computeLineTotals, sumCartTotals } from "@/shared/lib/money";
import { fromBaseQuantity, toBaseQuantity } from "@/shared/lib/units";
import { OFFLINE_PRICING_POLICY_VERSION } from "@/shared/lib/offline/products";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import type {
  LocalStockDeductions,
  OfflineCashPayment,
  OfflineSaleInput,
  OfflineSaleLine,
  OfflineSaleRecord,
} from "@/shared/lib/offline/sales-types";

export function parseRupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [rupees, paise = ""] = trimmed.split(".");
  return Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
}

export function validateCashPayment(totalPaise: number, receivedPaise: number): OfflineCashPayment {
  if (!Number.isInteger(receivedPaise) || receivedPaise < 0) {
    throw new Error("Enter a valid cash amount.");
  }
  if (receivedPaise < totalPaise) {
    throw new Error("Cash received is less than the sale total.");
  }
  return {
    method: "cash",
    amountPaise: totalPaise,
    receivedPaise,
    changePaise: receivedPaise - totalPaise,
  };
}

export function localStockDeductions(
  sales: OfflineSaleRecord[],
  snapshotSavedAt?: number,
): LocalStockDeductions {
  const snapshotTime = snapshotSavedAt ?? Number.POSITIVE_INFINITY;
  const out: LocalStockDeductions = {};
  for (const sale of sales) {
    if (sale.syncState === "cancelled") continue;
    if (sale.syncState === "synced"
      && sale.inventoryCoveredAt
      && new Date(sale.inventoryCoveredAt).getTime() <= snapshotTime) continue;
    for (const line of sale.lines) {
      out[line.productId] = (out[line.productId] ?? 0) + line.qtyBase;
    }
  }
  return out;
}

export function applyLocalStockDeductions<T extends ProductDTO>(
  items: T[],
  deductions: LocalStockDeductions,
): T[] {
  return items.map((item) => ({
    ...item,
    availableBase: Math.max(0, item.availableBase - (deductions[item._id] ?? 0)),
  }));
}

export function saleCanUseProducts(
  sale: OfflineSaleRecord,
  products: ProductDTO[],
  otherDeductions: LocalStockDeductions,
): { ok: true } | { ok: false; reason: string } {
  const byId = new Map(products.map((product) => [product._id, product]));
  for (const line of sale.lines) {
    const product = byId.get(line.productId);
    if (!product) return { ok: false, reason: `${line.name} is not in the refreshed product catalogue.` };
    if (product.status !== "active") return { ok: false, reason: `${line.name} is not active on the server.` };
    if (typeof product.basePricePaise !== "number") return { ok: false, reason: `${line.name} has no server price.` };
    if (line.saleUnit !== product.saleUnit) return { ok: false, reason: `${line.name} has a changed sale unit on the server.` };
    if (!line.priceOverridden && line.unitPricePaise !== product.basePricePaise) return { ok: false, reason: `${line.name} has a changed price on the server.` };
    if ((line.baseUnit ?? product.baseUnit) !== product.baseUnit) {
      return { ok: false, reason: `${line.name} has a changed measurement on the server.` };
    }
    if (line.taxRateBps !== product.taxRateBps) return { ok: false, reason: `${line.name} has a changed tax rule on the server.` };
    const availableBase = Math.max(0, product.availableBase - (otherDeductions[line.productId] ?? 0));
    if (line.qtyBase > availableBase) {
      const requested = fromBaseQuantity(line.qtyBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1], line.basePerSaleUnit);
      const available = fromBaseQuantity(availableBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1], line.basePerSaleUnit);
      return { ok: false, reason: `${line.name} needs ${requested} ${line.saleUnit}, but only ${available} ${line.saleUnit} is available in the refreshed catalogue.` };
    }
  }
  return { ok: true };
}

export function stockRecheckCandidate(sale: OfflineSaleRecord): boolean {
  if (sale.syncState !== "blocked" && sale.syncState !== "needs_review") return false;
  const message = sale.syncMessage?.toLowerCase() ?? "";
  if (!message) return true;
  return ["stock", "inventory", "available", "catalogue", "product", "server"].some((word) => message.includes(word));
}

function buildOfflineLines(lines: CartLine[]): OfflineSaleLine[] {
  return lines.map((line) => {
    const baseUnit = line.baseUnit ?? line.product.baseUnit;
    const basePerSaleUnit = line.basePerSaleUnit ?? line.product.basePerSaleUnit;
    const unitPricePaise = line.unitPricePaise ?? line.product.basePricePaise ?? 0;
    const qtyBase = toBaseQuantity(line.qty, line.saleUnit, basePerSaleUnit);
    const totals = computeLineTotals({
      qtyBase,
      unitPricePaise,
      basePerSaleUnit,
      taxRateBps: line.product.taxRateBps ?? 0,
      discountPaise: line.discountPaise,
    });
    return {
      productId: line.product._id,
      productSlug: line.product.slug,
      sku: line.product.sku,
      barcode: line.product.barcode,
      name: line.product.name,
      saleUnit: line.saleUnit,
      baseUnit,
      qty: line.qty,
      qtyBase,
      basePerSaleUnit,
      unitPricePaise,
      priceOverridden: line.priceOverridden === true,
      grossPaise: totals.grossPaise,
      discountPaise: totals.discountPaise,
      taxablePaise: totals.taxablePaise,
      taxRateBps: line.product.taxRateBps ?? 0,
      taxPaise: totals.taxPaise,
      netPaise: totals.netPaise,
      lotEvidence: (line.product.lots ?? []).map((lot) => ({
        lotId: lot.lotId,
        lotCode: lot.lotCode,
        qtyBase: lot.qty,
        expiresAt: lot.expiresAt,
      })),
    };
  });
}

function recalculateOfflineLine(line: OfflineSaleLine, qty: number): OfflineSaleLine {
  const qtyBase = toBaseQuantity(qty, line.saleUnit as Parameters<typeof toBaseQuantity>[1], line.basePerSaleUnit);
  const totals = computeLineTotals({
    qtyBase,
    unitPricePaise: line.unitPricePaise,
    basePerSaleUnit: line.basePerSaleUnit,
    taxRateBps: line.taxRateBps,
    discountPaise: Math.min(line.discountPaise, Math.max(0, Math.round((line.discountPaise * qtyBase) / Math.max(1, line.qtyBase)))),
  });
  return {
    ...line,
    qty,
    qtyBase,
    grossPaise: totals.grossPaise,
    discountPaise: totals.discountPaise,
    taxablePaise: totals.taxablePaise,
    taxPaise: totals.taxPaise,
    netPaise: totals.netPaise,
  };
}

export function applyOfflineSaleLineRepair(
  sale: OfflineSaleRecord,
  changes: Array<{ productId: string; qty?: number; remove?: boolean }>,
): OfflineSaleRecord {
  const byProduct = new Map(changes.map((change) => [change.productId, change]));
  const lines: OfflineSaleLine[] = [];
  for (const line of sale.lines) {
    const change = byProduct.get(line.productId);
    if (change?.remove) continue;
    if (typeof change?.qty === "number") {
      if (!Number.isFinite(change.qty) || change.qty <= 0) throw new Error("Enter a quantity greater than zero.");
      if (toBaseQuantity(change.qty, line.saleUnit as Parameters<typeof toBaseQuantity>[1], line.basePerSaleUnit) > line.qtyBase) throw new Error("Quantity can only be reduced while repairing an offline sale.");
      lines.push(recalculateOfflineLine(line, change.qty));
    } else {
      lines.push(line);
    }
  }
  if (lines.length === 0) throw new Error("At least one product must remain. Cancel the local sale instead.");
  const totals = sumCartTotals(lines);
  const payment = validateCashPayment(totals.netPaise, sale.payment.receivedPaise);
  return {
    ...sale,
    lines,
    grossPaise: totals.grossPaise,
    discountPaise: totals.discountPaise,
    taxPaise: totals.taxPaise,
    totalPaise: totals.netPaise,
    payment,
  };
}

export function buildOfflineSaleRecord(
  input: OfflineSaleInput,
  receiptSequence: number,
  now = new Date(),
  _existingDeductions: LocalStockDeductions = {},
): OfflineSaleRecord {
  if (input.lines.length === 0) throw new Error("Add at least one product before checkout.");
  const customerPhone = normalizeIndianMobile(input.customerPhone);
  if (!customerPhone) throw new Error("Enter a valid 10-digit Indian customer mobile number.");
  for (const line of input.lines) {
    if ((line.product as ProductDTO).status !== "active") throw new Error(`${line.product.name} is not active.`);
    if (typeof line.product.basePricePaise !== "number") throw new Error(`${line.product.name} has no saved price.`);
  }
  const saleLines = buildOfflineLines(input.lines);
  const cart = sumCartTotals(saleLines);
  const payment = validateCashPayment(cart.netPaise, input.cashReceivedPaise);
  const operationId = input.operationId ?? newUuid();
  const receiptNo = `LOCAL-${input.session.registerId.slice(0, 8).toUpperCase()}-${String(receiptSequence).padStart(6, "0")}`;
  const timestamp = now.toISOString();
  return {
    id: operationId,
    operationId,
    scope: input.scope,
    registerId: input.session.registerId,
    sessionId: input.session._id,
    receiptNo,
    receiptSequence,
    status: "completed",
    syncState: "pending",
    offlineGrantToken: input.offlineGrantToken,
    catalogueSnapshotVersion: input.catalogueSnapshotVersion ?? "catalogue-unknown",
    catalogueEffectiveAt: input.catalogueEffectiveAt ?? timestamp,
    pricingPolicyVersion: input.pricingPolicyVersion ?? OFFLINE_PRICING_POLICY_VERSION,
    inventoryCursor: input.inventoryCursor ?? "0",
    lines: saleLines,
    grossPaise: cart.grossPaise,
    discountPaise: cart.discountPaise,
    taxPaise: cart.taxPaise,
    totalPaise: cart.netPaise,
    payment,
    customerName: input.customerName.trim(),
    customerPhone,
    buyerCode: input.buyerCode?.trim() || undefined,
    marketingConsent: Boolean(input.marketingConsent),
    cashierId: input.cashierId,
    soldAt: timestamp,
    createdAt: timestamp,
    schemaVersion: 2,
  };
}
