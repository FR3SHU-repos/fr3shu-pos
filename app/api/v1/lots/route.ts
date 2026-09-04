import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import { receiveLotSchema } from "@/shared/schemas/lot";
import type { CertificationSnapshot } from "@/shared/interfaces/mongodb/catalog/certification";
import LotModel from "@/shared/models/mongodb/inventory/lot";
import ProductModel from "@/shared/models/mongodb/catalog/product";
import CertificationModel from "@/shared/models/mongodb/catalog/certification";
import InventoryBalanceModel from "@/shared/models/mongodb/inventory/inventoryBalance";
import StockMovementModel from "@/shared/models/mongodb/inventory/stockMovement";
import LocationModel from "@/shared/models/mongodb/identity/location";

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();
    const { searchParams } = new URL(req.url);
    const filter: Record<string, unknown> = { ...tenantFilter(session) };
    const productId = searchParams.get("productId");
    const locationId = searchParams.get("locationId");
    if (productId) filter.productId = productId;
    if (locationId) filter.receivedAtLocationId = locationId;

    const items = await LotModel.find(filter).sort({ expiryDate: 1, createdAt: -1 }).limit(200).lean();
    return NextResponse.json(success({ items }));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Owner", "Manager", "InventoryManager", "Admin"]);
    await mongoDB();

    const parsed = receiveLotSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid lot", parsed.error.message), { status: 400 });
    }
    const body = parsed.data;

    const product = await ProductModel.findOne({
      _id: body.productId,
      orgId: session.orgId,
    }).lean();
    if (!product) return NextResponse.json(failure("Product not found"), { status: 404 });

    const location = await LocationModel.findOne({
      _id: body.locationId,
      orgId: session.orgId,
    }).lean();
    if (!location) return NextResponse.json(failure("Location not found"), { status: 404 });

    const dup = await LotModel.findOne({
      orgId: session.orgId,
      productId: body.productId,
      lotCode: body.lotCode,
    });
    if (dup) {
      return NextResponse.json(failure("A lot with that code already exists for this product"), {
        status: 409,
      });
    }

    // Snapshot the product's organic certification onto the lot.
    let certSnapshot: CertificationSnapshot | undefined;
    if (product.certificationId) {
      const cert = await CertificationModel.findById(product.certificationId).lean();
      if (cert) {
        const now = Date.now();
        const inWindow =
          (!cert.validFrom || new Date(cert.validFrom).getTime() <= now) &&
          (!cert.validUntil || new Date(cert.validUntil).getTime() > now);
        certSnapshot = {
          certificationId: String(cert._id),
          scheme: cert.scheme,
          verificationStatus: cert.verificationStatus,
          certificateNumber: cert.certificateNumber,
          certifyingBody: cert.certifyingBody,
          validUntil: cert.validUntil,
          isVerifiedOrganic: cert.verificationStatus === "Approved" && inWindow,
        };
      }
    }

    const txn = await mongoose.connection.startSession();
    let lotId = "";
    try {
      await txn.withTransaction(async () => {
        const [lot] = await LotModel.create(
          [
            {
              orgId: session.orgId,
              productId: body.productId,
              lotCode: body.lotCode,
              receivedBase: body.receivedBase,
              receivedUnit: body.receivedUnit,
              status: "active",
              producerName: body.producerName,
              fpoName: body.fpoName,
              farmOrProducerId: body.farmOrProducerId,
              harvestDate: body.harvestDate ? new Date(body.harvestDate) : undefined,
              packingDate: body.packingDate ? new Date(body.packingDate) : undefined,
              expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
              certificationSnapshot: certSnapshot,
              receivedBy: session.sub,
              receivedAtLocationId: body.locationId,
            },
          ],
          { session: txn, ordered: true },
        );
        lotId = String(lot._id);

        await InventoryBalanceModel.findOneAndUpdate(
          {
            orgId: session.orgId,
            locationId: body.locationId,
            productId: body.productId,
            lotId,
          },
          { $inc: { availableBase: body.receivedBase }, $setOnInsert: { reservedBase: 0 } },
          { upsert: true, new: true, session: txn },
        );

        await StockMovementModel.create(
          [
            {
              orgId: session.orgId,
              locationId: body.locationId,
              productId: body.productId,
              lotId,
              type: "receipt",
              deltaBase: body.receivedBase,
              balanceAfterBase: body.receivedBase,
              refType: "Lot",
              refId: lotId,
              actorId: session.sub,
              note: `Received lot ${body.lotCode}`,
            },
          ],
          { session: txn, ordered: true },
        );
      });
    } finally {
      await txn.endSession();
    }

    const lot = await LotModel.findById(lotId).lean();
    return NextResponse.json(success(lot, "Lot received"), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
