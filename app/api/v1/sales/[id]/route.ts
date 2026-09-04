import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import SaleModel from "@/shared/models/mongodb/pos/sale";
import PaymentModel from "@/shared/models/mongodb/pos/payment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = requireSession(req);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(failure("Invalid id"), { status: 400 });
    }
    await mongoDB();

    const sale = await SaleModel.findOne({ _id: id, ...tenantFilter(session) }).lean();
    if (!sale) return NextResponse.json(failure("Sale not found"), { status: 404 });

    const payments = await PaymentModel.find({ saleId: id }).sort({ recordedAt: 1 }).lean();
    return NextResponse.json(success({ sale, payments }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
