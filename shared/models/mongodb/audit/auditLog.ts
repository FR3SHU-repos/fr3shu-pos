import mongoose, { Schema, type Model } from "mongoose";
import type { IAuditLog } from "@/shared/interfaces/mongodb/audit/auditLog";

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: String, required: true, index: true },
    orgId: { type: String, index: true },
    locationId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    requestId: String,
    deviceId: String,
  },
  { timestamps: true },
);

AuditLogSchema.index({ orgId: 1, entity: 1, createdAt: -1 });

const AuditLogModel: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLogModel;
