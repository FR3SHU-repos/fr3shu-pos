import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success } from "@/app/api/v1/utils/responses";
import { requireSession, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import InventoryBalanceModel from "@/shared/models/mongodb/inventory/inventoryBalance";
import ProductModel from "@/shared/models/mongodb/catalog/product";
import LotModel from "@/shared/models/mongodb/inventory/lot";

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();

    const { searchParams } = new URL(req.url);
    const filter: Record<string, unknown> = { ...tenantFilter(session) };
    const productId = searchParams.get("productId");
    const locationId = searchParams.get("locationId") ?? session.locationId;
    if (productId) filter.productId = productId;
    if (locationId) filter.locationId = locationId;

    const balances = await InventoryBalanceModel.find(filter).sort({ updatedAt: -1 }).limit(500).lean();

    const productIds = [...new Set(balances.map((b) => String(b.productId)))];
    const lotIds = [...new Set(balances.map((b) => String(b.lotId)))];
    const [products, lots] = await Promise.all([
      ProductModel.find({ _id: { $in: productIds } }).select("name saleUnit sku").lean(),
      LotModel.find({ _id: { $in: lotIds } }).select("lotCode expiryDate").lean(),
    ]);
    const pMap = new Map(products.map((p) => [String(p._id), p]));
    const lMap = new Map(lots.map((l) => [String(l._id), l]));

    const items = balances.map((b) => ({
      ...b,
      productName: pMap.get(String(b.productId))?.name,
      sku: pMap.get(String(b.productId))?.sku,
      saleUnit: pMap.get(String(b.productId))?.saleUnit,
      lotCode: lMap.get(String(b.lotId))?.lotCode,
      expiryDate: lMap.get(String(b.lotId))?.expiryDate,
    }));

    return NextResponse.json(success({ items }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
