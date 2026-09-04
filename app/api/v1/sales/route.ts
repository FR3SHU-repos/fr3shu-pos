import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure, pageMeta } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import { createSaleSchema } from "@/shared/schemas/sale";
import { createSale, SaleError } from "@/shared/services/sales";
import SaleModel from "@/shared/models/mongodb/pos/sale";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const receiptNo = searchParams.get("receiptNo")?.trim();
    const phone = searchParams.get("phone")?.trim();

    const filter: Record<string, unknown> = { ...tenantFilter(session) };
    if (session.locationId) filter.locationId = session.locationId;
    if (receiptNo) filter.receiptNo = new RegExp(`^${escapeRe(receiptNo)}`, "i");
    if (phone) filter.customerPhone = phone;

    const [items, total] = await Promise.all([
      SaleModel.find(filter)
        .sort({ soldAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SaleModel.countDocuments(filter),
    ]);

    return NextResponse.json(success({ items, meta: pageMeta(total, page, limit) }));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Cashier", "Manager", "Owner", "Admin"]);
    await mongoDB();

    const parsed = createSaleSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid sale", parsed.error.message), { status: 400 });
    }

    const { sale, reused } = await createSale(session, parsed.data);
    return NextResponse.json(
      success({ sale, reused }, reused ? "Sale already recorded" : "Sale completed"),
      { status: reused ? 200 : 201 },
    );
  } catch (err) {
    if (err instanceof SaleError) {
      return NextResponse.json(failure(err.message), { status: err.status });
    }
    return toErrorResponse(err);
  }
}
