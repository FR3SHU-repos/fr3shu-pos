import type { SessionDTO } from "@/shared/lib/api/registers";
import type { CartLine } from "@/shared/components/pos/types";
import type { BaseUnit } from "@/shared/lib/units";

export type OfflineSaleSyncState =
  | "pending"
  | "uploading"
  | "retry_wait"
  | "synced"
  | "blocked"
  | "cancelled"
  | "needs_review"
  | "auth_required";

export interface OfflineScope {
  userId: string;
  orgId: string;
  locationId: string;
}

export type OfflineStorageStatus = "ready" | "unsafe" | "unknown";

export interface OfflineStorageReadiness {
  status: OfflineStorageStatus;
  persisted: boolean;
  availableBytes?: number;
  checkedAt: number;
}

export interface OfflineReadiness {
  deviceId: string;
  grantId: string;
  grantToken: string;
  registerId: string;
  terminalId: string;
  shiftId: string;
  issuedAt: string;
  expiresAt: string;
  preparedAt: number;
  storage: OfflineStorageReadiness;
}

export interface OfflineCashPayment {
  method: "cash";
  amountPaise: number;
  receivedPaise: number;
  changePaise: number;
}

export interface OfflineLotEvidence {
  lotId: string;
  lotCode?: string;
  qtyBase: number;
  expiresAt?: string;
}

export interface OfflineSaleLine {
  productId: string;
  productSlug?: string;
  sku: string;
  barcode?: string;
  name: string;
  saleUnit: string;
  baseUnit?: BaseUnit;
  qty: number;
  qtyBase: number;
  basePerSaleUnit: number;
  unitPricePaise: number;
  priceOverridden?: boolean;
  grossPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxRateBps: number;
  taxPaise: number;
  netPaise: number;
  lotEvidence: OfflineLotEvidence[];
}

export interface OfflineSaleRecord {
  id: string;
  operationId: string;
  scope: OfflineScope;
  registerId: string;
  sessionId: string;
  receiptNo: string;
  receiptSequence: number;
  status: "completed";
  syncState: OfflineSaleSyncState;
  syncMessage?: string;
  syncReviewId?: string;
  syncFailureStage?: string;
  syncFailureCode?: string;
  syncFailureDetail?: string;
  syncRequestId?: string;
  syncTraceId?: string;
  serverSaleId?: string;
  serverReceiptNo?: string;
  inventoryCoveredAt?: string;
  inventoryCursor?: string;
  serverInventoryCursor?: string;
  lastSyncAttemptAt?: string;
  syncAttempts?: number;
  offlineGrantToken?: string;
  catalogueSnapshotVersion: string;
  catalogueEffectiveAt: string;
  pricingPolicyVersion: string;
  lines: OfflineSaleLine[];
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  payment: OfflineCashPayment;
  customerName: string;
  customerPhone: string;
  buyerCode?: string;
  marketingConsent: boolean;
  cashierId: string;
  soldAt: string;
  createdAt: string;
  schemaVersion: 1 | 2;
}

export interface OfflineOutboxEntry {
  id: string;
  saleId: string;
  operationId: string;
  scope: OfflineScope;
  kind: "sale.cash.v1";
  status: Exclude<OfflineSaleSyncState, "synced">;
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  leaseId?: string;
  leaseExpiresAt?: string;
}

export interface OfflineSaleSyncOperation {
  operationId: string;
  offlineGrantToken?: string;
  registerId: string;
  sessionId: string;
  deviceReceiptNo: string;
  occurredAt: string;
  catalogueSnapshotVersion?: string;
  catalogueEffectiveAt?: string;
  pricingPolicyVersion?: string;
  inventoryCursor?: string;
  customerName: string;
  customerPhone: string;
  buyerCode?: string;
  marketingConsent: boolean;
  lines: Array<{
    skuId: string;
    qty: string;
    unit: string;
    baseUnit?: BaseUnit;
    basePerSaleUnit?: number;
    unitPriceMinor: number;
    priceOverridden?: boolean;
    grossMinor: number;
    discountMinor: number;
    taxRateBps: number;
    taxMinor: number;
    netMinor: number;
    lotEvidence: Array<{
      lotId: string;
      lotCode?: string;
      quantity: string;
      expiresAt?: string;
    }>;
  }>;
  cashReceivedMinor: number;
  cashAppliedMinor: number;
  changeMinor: number;
  totalMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
}

export interface OfflineReferenceMappings {
  productIds: Record<string, string>;
  lotIds: Record<string, string>;
}

export interface OfflineSaleInput {
  scope: OfflineScope;
  session: SessionDTO;
  cashierId: string;
  lines: CartLine[];
  cashReceivedPaise: number;
  customerName: string;
  customerPhone: string;
  buyerCode?: string;
  marketingConsent?: boolean;
  operationId?: string;
  offlineGrantToken?: string;
  catalogueSnapshotVersion?: string;
  catalogueEffectiveAt?: string;
  pricingPolicyVersion?: string;
  inventoryCursor?: string;
}

export type LocalStockDeductions = Record<string, number>;

export function offlineScopeKey(scope: OfflineScope): string {
  return JSON.stringify([scope.userId, scope.orgId, scope.locationId]);
}

export interface OfflineSalesExport {
  exportedAt: string;
  scope: OfflineScope;
  sales: OfflineSaleRecord[];
}

export interface OfflineSalesImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface OfflineSaleCustomerPatch {
  customerName: string;
  customerPhone: string;
  buyerCode?: string;
  marketingConsent?: boolean;
}

export interface OfflineSaleSyncDiagnostic {
  failureStage?: string;
  failureCode?: string;
  failureDetail?: string;
  requestId?: string;
  traceId?: string;
}
