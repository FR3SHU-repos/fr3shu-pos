import mongoose, { Schema, type Model } from "mongoose";
import type { IPosSession } from "@/shared/interfaces/mongodb/pos/posSession";

const TotalsSchema = new Schema(
  {
    cashSalesPaise: { type: Number, default: 0 },
    upiSalesPaise: { type: Number, default: 0 },
    cardSalesPaise: { type: Number, default: 0 },
    refundsPaise: { type: Number, default: 0 },
    cashInPaise: { type: Number, default: 0 },
    cashOutPaise: { type: Number, default: 0 },
    saleCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const PosSessionSchema = new Schema<IPosSession>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    registerId: { type: String, required: true, index: true },
    openedBy: { type: String, required: true },
    openedAt: { type: Date, required: true, default: Date.now },
    openingCashPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    totals: {
      type: TotalsSchema,
      default: () => ({}),
    },
    closedBy: String,
    closedAt: Date,
    expectedCashPaise: Number,
    countedCashPaise: Number,
    cashVariancePaise: Number,
    varianceNote: String,
  },
  { timestamps: true },
);

// At most one open session per register (enforced in service + partial unique index).
PosSessionSchema.index(
  { registerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
PosSessionSchema.index({ orgId: 1, locationId: 1, openedAt: -1 });

const PosSessionModel: Model<IPosSession> =
  mongoose.models.PosSession ||
  mongoose.model<IPosSession>("PosSession", PosSessionSchema);
export default PosSessionModel;
