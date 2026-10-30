import {
  OUTBOX_STORE,
  SALE_STORE,
  notifyOfflineSalesChanged,
  openOfflineDatabase,
  requestResult,
  storageError,
  txDone,
} from "@/shared/lib/offline/sales-storage";
import {
  type OfflineOutboxEntry,
  type OfflineSaleRecord,
  type OfflineSaleSyncState,
  type OfflineSalesImportResult,
  type OfflineScope,
} from "@/shared/lib/offline/sales-types";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";

const IMPORTABLE_SYNC_STATES = new Set<OfflineSaleSyncState>([
  "pending",
  "uploading",
  "retry_wait",
  "synced",
  "blocked",
  "cancelled",
  "needs_review",
  "auth_required",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidOfflineScope(value: unknown, scope: OfflineScope): value is OfflineScope {
  return (
    isObject(value) &&
    value.userId === scope.userId &&
    value.orgId === scope.orgId &&
    value.locationId === scope.locationId
  );
}

function validateImportedSale(
  value: unknown,
  scope: OfflineScope,
  index: number,
): OfflineSaleRecord | string {
  if (!isObject(value)) return `Record ${index + 1} is not an object.`;
  const requiredStrings = [
    "id",
    "operationId",
    "registerId",
    "sessionId",
    "receiptNo",
    "customerName",
    "customerPhone",
    "cashierId",
    "soldAt",
    "createdAt",
    "catalogueSnapshotVersion",
    "catalogueEffectiveAt",
    "pricingPolicyVersion",
  ];
  if (requiredStrings.some((key) => typeof value[key] !== "string" || !String(value[key]).trim()))
    return `Record ${index + 1} is missing required text fields.`;
  if (!normalizeIndianMobile(String(value.customerPhone)))
    return `Record ${index + 1} has an invalid customer mobile number.`;
  if (value.id !== value.operationId)
    return `Record ${index + 1} has mismatched record and operation IDs.`;
  if (!isValidOfflineScope(value.scope, scope))
    return `Record ${index + 1} belongs to a different user, organization, or location.`;
  if (value.status !== "completed" || (value.schemaVersion !== 1 && value.schemaVersion !== 2))
    return `Record ${index + 1} has an unsupported schema or status.`;
  if (
    typeof value.syncState !== "string" ||
    !IMPORTABLE_SYNC_STATES.has(value.syncState as OfflineSaleSyncState)
  )
    return `Record ${index + 1} has an unsupported sync state.`;
  if (!Array.isArray(value.lines) || value.lines.length === 0)
    return `Record ${index + 1} must contain at least one product line.`;
  if (
    !isObject(value.payment) ||
    value.payment.method !== "cash" ||
    !finiteNonNegative(value.payment.amountPaise) ||
    !finiteNonNegative(value.payment.receivedPaise) ||
    !finiteNonNegative(value.payment.changePaise)
  )
    return `Record ${index + 1} has invalid payment data.`;
  for (const [lineIndex, line] of value.lines.entries()) {
    if (
      !isObject(line) ||
      ["productId", "sku", "name", "saleUnit"].some(
        (key) => typeof line[key] !== "string" || !String(line[key]).trim(),
      ) ||
      !finiteNonNegative(line.qty) ||
      line.qty <= 0 ||
      !finiteNonNegative(line.qtyBase) ||
      !finiteNonNegative(line.unitPricePaise) ||
      !finiteNonNegative(line.grossPaise) ||
      !finiteNonNegative(line.discountPaise) ||
      !finiteNonNegative(line.taxablePaise) ||
      !finiteNonNegative(line.taxRateBps) ||
      !finiteNonNegative(line.taxPaise) ||
      !finiteNonNegative(line.netPaise)
    ) {
      return `Record ${index + 1}, line ${lineIndex + 1} has invalid product data.`;
    }
  }
  const dateFields = ["soldAt", "createdAt", "catalogueEffectiveAt"];
  if (dateFields.some((key) => Number.isNaN(Date.parse(String(value[key])))))
    return `Record ${index + 1} has an invalid date.`;
  const rawState = value.syncState as OfflineSaleSyncState;
  return {
    ...(value as unknown as OfflineSaleRecord),
    syncState: rawState === "uploading" ? "pending" : rawState,
    syncMessage:
      rawState === "uploading"
        ? "Restored from backup and queued for sync."
        : typeof value.syncMessage === "string"
          ? value.syncMessage
          : undefined,
  };
}

/** Restores only records for the current scope without replacing existing records. */
export async function importOfflineSales(
  scope: OfflineScope,
  payload: unknown,
): Promise<OfflineSalesImportResult> {
  const result: OfflineSalesImportResult = { imported: 0, skipped: 0, errors: [] };
  if (
    !isObject(payload) ||
    !isValidOfflineScope(payload.scope, scope) ||
    !Array.isArray(payload.sales)
  ) {
    result.errors.push(
      "This backup is invalid or belongs to a different user, organization, or location.",
    );
    return result;
  }
  const candidates: OfflineSaleRecord[] = [];
  const seen = new Set<string>();
  for (const [index, value] of payload.sales.entries()) {
    const sale = validateImportedSale(value, scope, index);
    if (typeof sale === "string") {
      result.errors.push(sale);
      continue;
    }
    if (seen.has(sale.operationId)) {
      result.skipped += 1;
      continue;
    }
    seen.add(sale.operationId);
    candidates.push(sale);
  }
  if (candidates.length === 0) return result;
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const salesStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const existingSales = await requestResult<OfflineSaleRecord[]>(salesStore.getAll());
    const existingOperationIds = new Set(existingSales.map((sale) => sale.operationId));
    for (const sale of candidates) {
      if (existingOperationIds.has(sale.operationId)) {
        result.skipped += 1;
        continue;
      }
      salesStore.add(sale);
      if (["pending", "retry_wait", "auth_required"].includes(sale.syncState)) {
        const now = new Date().toISOString();
        outboxStore.add({
          id: sale.operationId,
          saleId: sale.id,
          operationId: sale.operationId,
          scope: sale.scope,
          kind: "sale.cash.v1",
          status: "pending",
          attempts: sale.syncAttempts ?? 0,
          nextAttemptAt: now,
          createdAt: sale.createdAt,
          updatedAt: now,
        } satisfies OfflineOutboxEntry);
      }
      existingOperationIds.add(sale.operationId);
      result.imported += 1;
    }
    await txDone(tx);
    notifyOfflineSalesChanged();
    return result;
  } catch (error) {
    throw storageError(error);
  } finally {
    db.close();
  }
}
