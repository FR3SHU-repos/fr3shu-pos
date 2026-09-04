import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure, pageMeta } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import { createProductSchema } from "@/shared/schemas/product";
import { BASE_PER_SALE_UNIT, SALE_UNIT_BASE } from "@/shared/lib/units";
import ProductModel from "@/shared/models/mongodb/catalog/product";

// Escape user input before it reaches a RegExp.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

    const filter: Record<string, unknown> = { ...tenantFilter(session) };
    if (status) filter.status = status;
    else filter.status = { $ne: "archived" };

    if (q) {
      const re = new RegExp(escapeRe(q), "i");
      filter.$or = [{ name: re }, { sku: re }, { barcode: re }];
    }

    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ isPinned: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    return NextResponse.json(success({ items, meta: pageMeta(total, page, limit) }));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Owner", "Manager", "Admin"]);
    await mongoDB();

    const parsed = createProductSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid product", parsed.error.message), { status: 400 });
    }
    const body = parsed.data;

    if (SALE_UNIT_BASE[body.saleUnit] !== body.baseUnit) {
      return NextResponse.json(
        failure(`saleUnit "${body.saleUnit}" does not belong to baseUnit "${body.baseUnit}"`),
        { status: 400 },
      );
    }
    const expectedBasePer = BASE_PER_SALE_UNIT[body.saleUnit];
    if (body.basePerSaleUnit !== expectedBasePer) {
      return NextResponse.json(
        failure(`basePerSaleUnit for "${body.saleUnit}" must be ${expectedBasePer}`),
        { status: 400 },
      );
    }

    const dup = await ProductModel.findOne({ orgId: session.orgId, sku: body.sku });
    if (dup) {
      return NextResponse.json(failure("A product with that SKU already exists"), { status: 409 });
    }

    const product = await ProductModel.create({ ...body, orgId: session.orgId });
    return NextResponse.json(success(product, "Product created"), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
