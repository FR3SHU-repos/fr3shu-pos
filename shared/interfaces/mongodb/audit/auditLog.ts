export interface IAuditLog {
  _id?: string;

  actorId: string;
  orgId?: string;
  locationId?: string;

  action: string;
  entity: string;
  entityId?: string;

  before?: unknown;
  after?: unknown;

  requestId?: string;
  deviceId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
