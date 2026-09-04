import mongoose from "mongoose";
import { mongoDB } from "@/shared/lib/db/mongo";
import { toBaseQuantity, sortLotsFefo, SALE_UNIT_BASE, type SaleUnit } from "@/shared/lib/units";
import { priceSaleLine, priceCart } from "@/shared/services/pricing";
import { tenderDeltaFromPayments } from "@/shared/services/registers";
import type { PosTokenPayload } from "@/shared/lib/auth";
import type { CreateSaleInput } from "@/shared/schemas/sale";
import type { ISale, ISaleItem } from "@/shared/interfaces/mongodb/pos/sale";
import type { CertificationSnapshot } from "@/shared/interfaces/mongodb/catalog/certification";

import ProductModel from "@/shared/models/mongodb/catalog/product";
import ProductPriceModel from "@/shared/models/mongodb/catalog/productPrice";
import LotModel from "@/shared/models/mongodb/inventory/lot";
import InventoryBalanceModel from "@/shared/models/mongodb/inventory/inventoryBalance";
import StockMovementModel from "@/shared/models/mongodb/inventory/stockMovement";
import PosSessionModel from "@/shared/models/mongodb/pos/posSession";
import SaleModel from "@/shared/models/mongodb/pos/sale";
import PaymentModel from "@/shared/models/mongodb/pos/payment";
import AuditLogModel from "@/shared/models/mongodb/audit/auditLog";

export class SaleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const LOT_OVERRIDE_ROLES = new Set(["Owner", "Manager", "Admin"]);

function receiptNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const tail = Date.now().toString(36).slice(-5).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 2)
    .toString(36)
    .padStart(2, "0")
    .toUpperCase();
  return `R${ymd}-${tail}${rand}`;
}

function organicSnapshot(
  lotSnap: CertificationSnapshot | undefined,
  productOrganicStatus: string,
  certificationId?: string,
): CertificationSnapshot {
  if (lotSnap) return lotSnap;
  return {
    certificationId,
    verificationStatus:
      productOrganicStatus === "Verified" ? "Approved" : "PendingVerification",
    isVerifiedOrganic: productOrganicStatus === "Verified",
  };
}

export interface CreateSaleResult {
  sale: ISale & { _id: string };
  reused: boolean;
}

/**
 * Create a sale, its payments, stock decrements and movement ledger rows in a
 * single MongoDB transaction. Idempotent on `input.idempotencyKey`.
 *
 * Guarantees:
 *  - line totals are recomputed server-side from ProductPrice (client amounts ignored)
 *  - each lot balance is decremented with an atomic `$gte` guard (no oversell)
 *  - a retry with the same idempotency key returns the original sale, no second effect
 *  - split payments must sum exactly to the server-computed total
 */
export async function createSale(
  session: PosTokenPayload,
  input: CreateSaleInput,
): Promise<CreateSaleResult> {
  await mongoDB();

  // 1. Idempotency fast-path.
  const existing = await SaleModel.findOne({ idempotencyKey: input.idempotencyKey }).lean();
  if (existing) {
    return { sale: existing as ISale & { _id: string }, reused: true };
  }

  const orgId = session.orgId;
  const locationId = session.locationId;
  if (!orgId || !locationId) {
    throw new SaleError("Your account is not scoped to an organisation and location", 403);
  }

  // 2. Resolve the open register session.
  const posSession = input.sessionId
    ? await PosSessionModel.findOne({ _id: input.sessionId, orgId, status: "open" })
    : await PosSessionModel.findOne({ orgId, locationId, status: "open" }).sort({
        openedAt: -1,
      });
  if (!posSession) throw new SaleError("No open register session for this location", 409);

  // 3. Load products (tenant-scoped) and their location prices.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await ProductModel.find({
    _id: { $in: productIds },
    orgId,
    status: "active",
  }).lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  for (const id of productIds) {
    if (!productById.has(id)) {
      throw new SaleError(`Product ${id} not found, not active, or not in your organisation`, 404);
    }
  }

  const prices = await ProductPriceModel.find({
    orgId,
    locationId,
    productId: { $in: productIds },
  }).lean();

  // 4. Load candidate inventory balances + lots for FEFO selection.
  const balances = await InventoryBalanceModel.find({
    orgId,
    locationId,
    productId: { $in: productIds },
    availableBase: { $gt: 0 },
  }).lean();
  const lotIds = [...new Set(balances.map((b) => String(b.lotId)))];
  const lots = await LotModel.find({ _id: { $in: lotIds }, status: "active" }).lean();
  const lotById = new Map(lots.map((l) => [String(l._id), l]));

  type PlannedLine = {
    balanceId: string;
    lotId: string;
    qtyBase: number;
    item: ISaleItem;
  };
  const planned: PlannedLine[] = [];

  for (const line of input.items) {
    const product = productById.get(line.productId)!;
    const unit = line.saleUnit as SaleUnit;

    // Unit must be compatible with the product's base family.
    if (SALE_UNIT_BASE[unit] !== product.baseUnit) {
      throw new SaleError(
        `Unit "${unit}" is not compatible with product "${product.name}" (${product.baseUnit})`,
      );
    }

    const qtyBase = toBaseQuantity(line.qty, unit);
    if (qtyBase <= 0) throw new SaleError(`Quantity for "${product.name}" must be positive`);

    // Candidate balances for this product, joined to their lot, FEFO-ordered.
    const productBalances = balances
      .filter((b) => String(b.productId) === line.productId)
      .map((b) => ({ balance: b, lot: lotById.get(String(b.lotId)) }))
      .filter((x) => x.lot);
    const ordered = sortLotsFefo(
      productBalances.map((x) => ({ ...x.lot!, _bId: String(x.balance._id), _avail: x.balance.availableBase })),
    ) as Array<Record<string, unknown> & { _bId: string; _avail: number; _id: unknown }>;

    let chosen: { balanceId: string; lotId: string } | null = null;

    if (line.lotId) {
      if (!LOT_OVERRIDE_ROLES.has(session.role)) {
        throw new SaleError("You are not permitted to override the lot selection", 403);
      }
      if (!line.lotOverrideReason || line.lotOverrideReason.trim().length < 3) {
        throw new SaleError("A reason is required to override the lot selection");
      }
      const match = ordered.find((l) => String(l._id) === line.lotId);
      if (!match) throw new SaleError(`Lot ${line.lotId} has no available stock at this location`);
      if (match._avail < qtyBase) {
        throw new SaleError(`Insufficient stock in lot for "${product.name}"`);
      }
      chosen = { balanceId: match._bId, lotId: line.lotId };
    } else {
      const match = ordered.find((l) => l._avail >= qtyBase);
      if (!match) {
        throw new SaleError(
          `Insufficient stock for "${product.name}" in any single lot`,
          409,
        );
      }
      chosen = { balanceId: match._bId, lotId: String(match._id) };
    }

    const lot = lotById.get(chosen.lotId)!;
    const priced = priceSaleLine({
      product,
      locationPrices: prices,
      qtyBase,
      discountPaise: line.discountPaise,
    });

    const item: ISaleItem = {
      productId: line.productId,
      lotId: chosen.lotId,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      saleUnit: unit,
      qtyBase,
      basePerSaleUnit: product.basePerSaleUnit,
      unitPricePaise: priced.unitPricePaise,
      grossPaise: priced.totals.grossPaise,
      discountPaise: priced.totals.discountPaise,
      taxRateBps: priced.taxRateBps,
      taxPaise: priced.totals.taxPaise,
      netPaise: priced.totals.netPaise,
      organic: organicSnapshot(
        lot.certificationSnapshot as CertificationSnapshot | undefined,
        product.organicStatus,
        product.certificationId,
      ),
    };

    planned.push({ balanceId: chosen.balanceId, lotId: chosen.lotId, qtyBase, item });
  }

  // 5. Server-authoritative totals + payment reconciliation.
  const cart = priceCart(
    planned.map((p) => ({
      grossPaise: p.item.grossPaise,
      discountPaise: p.item.discountPaise,
      taxablePaise: p.item.grossPaise - p.item.discountPaise,
      taxPaise: p.item.taxPaise,
      netPaise: p.item.netPaise,
    })),
    input.cartDiscountPaise ?? 0,
  );
  const paymentsTotal = input.payments.reduce((s, p) => s + p.amountPaise, 0);
  if (paymentsTotal !== cart.netPaise) {
    throw new SaleError(
      `Payments (${paymentsTotal}p) do not match the sale total (${cart.netPaise}p)`,
    );
  }

  // 6. Transaction: decrement stock atomically, then write sale/payments/movements.
  const receipt = receiptNo();
  const conn = mongoose.connection;
  const txn = await conn.startSession();
  let createdId: string;

  try {
    await txn.withTransaction(async () => {
      for (const p of planned) {
        const updated = await InventoryBalanceModel.findOneAndUpdate(
          { _id: p.balanceId, availableBase: { $gte: p.qtyBase } },
          { $inc: { availableBase: -p.qtyBase } },
          { new: true, session: txn },
        );
        if (!updated) {
          throw new SaleError(`Stock changed for "${p.item.name}" — please retry`, 409);
        }
      }

      const [sale] = await SaleModel.create(
        [
          {
            orgId,
            locationId,
            registerId: String(posSession.registerId),
            sessionId: String(posSession._id),
            receiptNo: receipt,
            idempotencyKey: input.idempotencyKey,
            status: "completed",
            items: planned.map((p) => p.item),
            grossPaise: cart.grossPaise,
            discountPaise: cart.discountPaise,
            taxPaise: cart.taxPaise,
            totalPaise: cart.netPaise,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            marketingConsent: input.marketingConsent ?? false,
            cashierId: session.sub,
            soldAt: new Date(),
            syncState: "synced",
            deviceId: input.deviceId,
          },
        ],
        { session: txn, ordered: true },
      );
      createdId = String(sale._id);

      await PaymentModel.create(
        input.payments.map((pay) => ({
          orgId,
          locationId,
          sessionId: String(posSession._id),
          saleId: createdId,
          method: pay.method,
          amountPaise: pay.amountPaise,
          upiRef: pay.upiRef,
          recordedBy: session.sub,
          recordedAt: new Date(),
        })),
        { session: txn, ordered: true },
      );

      await StockMovementModel.create(
        planned.map((p) => ({
          orgId,
          locationId,
          productId: p.item.productId,
          lotId: p.lotId,
          type: "sale",
          deltaBase: -p.qtyBase,
          refType: "Sale",
          refId: createdId,
          actorId: session.sub,
          note: `Sale ${receipt}`,
        })),
        { session: txn, ordered: true },
      );

      const tender = tenderDeltaFromPayments(input.payments);
      await PosSessionModel.updateOne(
        { _id: posSession._id },
        {
          $inc: {
            "totals.cashSalesPaise": tender.cashSalesPaise,
            "totals.upiSalesPaise": tender.upiSalesPaise,
            "totals.cardSalesPaise": tender.cardSalesPaise,
            "totals.saleCount": 1,
          },
        },
        { session: txn },
      );
    });
  } catch (err) {
    // A concurrent request with the same idempotency key won the race.
    if ((err as { code?: number }).code === 11000) {
      const dup = await SaleModel.findOne({ idempotencyKey: input.idempotencyKey }).lean();
      if (dup) return { sale: dup as ISale & { _id: string }, reused: true };
    }
    throw err;
  } finally {
    await txn.endSession();
  }

  AuditLogModel.create({
    actorId: session.sub,
    orgId,
    locationId,
    action: "sale.create",
    entity: "Sale",
    entityId: createdId!,
    after: { receiptNo: receipt, totalPaise: cart.netPaise, items: planned.length },
    deviceId: input.deviceId,
  }).catch((e) => console.error("[audit] sale.create:", (e as Error).message));

  const sale = await SaleModel.findById(createdId!).lean();
  return { sale: sale as ISale & { _id: string }, reused: false };
}
