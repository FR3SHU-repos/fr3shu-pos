import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import { updateProductSchema } from "@/shared/schemas/product";
import ProductModel from "@/shared/models/mongodb/catalog/product";

type Ctx = { params: Promise<{ id: string }> };

// Only these fields may ever be changed through the API — the raw body is never $set.
const UPDATABLE = [
  "name",
  "barcode",
  "categoryId",
  "description",
  "taxRateBps",
  "basePricePaise",
  "certificationId",
  "organicStatus",
  "isPinned",
  "status",
] as const;

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = requireSession(req);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(failure("Invalid id"), { status: 400 });
    }
    await mongoDB();
    const doc = await ProductModel.findOne({ _id: id, ...tenantFilter(session) }).lean();
    if (!doc) return NextResponse.json(failure("Product not found"), { status: 404 });
    return NextResponse.json(success(doc));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Owner", "Manager", "Admin"]);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(failure("Invalid id"), { status: 400 });
    }
    await mongoDB();

    const parsed = updateProductSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid update", parsed.error.message), { status: 400 });
    }

    const set: Record<string, unknown> = {};
    for (const key of UPDATABLE) {
      if (key in parsed.data && parsed.data[key as keyof typeof parsed.data] !== undefined) {
        set[key] = parsed.data[key as keyof typeof parsed.data];
      }
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json(failure("No updatable fields supplied"), { status: 400 });
    }

    const updated = await ProductModel.findOneAndUpdate(
      { _id: id, ...tenantFilter(session) },
      { $set: set },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return NextResponse.json(failure("Product not found"), { status: 404 });
    return NextResponse.json(success(updated, "Product updated"));
  } catch (err) {
    return toErrorResponse(err);
  }
}
