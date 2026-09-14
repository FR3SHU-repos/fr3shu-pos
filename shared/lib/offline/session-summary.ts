import type { SaleDTO } from "@/shared/lib/api/sales";
import type { OfflineSaleRecord, OfflineSaleSyncState } from "@/shared/lib/offline/sales";
import { offlineSaleToDTO } from "@/shared/lib/offline/sales";

export interface MergedSaleRow {
  sale: SaleDTO;
  local: boolean;
  state: SaleDTO["syncState"] | OfflineSaleSyncState;
  serverSaleId?: string;
  serverReceiptNo?: string;
}

export function activeOfflineCashSales(sales: OfflineSaleRecord[]): OfflineSaleRecord[] {
  return sales.filter((sale) => sale.syncState !== "cancelled" && sale.syncState !== "synced");
}

export function visibleOfflineSales(sales: OfflineSaleRecord[], _today: string): OfflineSaleRecord[] {
  return sales.filter((sale) => sale.syncState !== "cancelled" && sale.syncState !== "synced");
}

export function pendingOfflineCashTotal(sales: OfflineSaleRecord[]): { amountPaise: number; count: number } {
  const active = activeOfflineCashSales(sales);
  return {
    amountPaise: active.reduce((sum, sale) => sum + sale.totalPaise, 0),
    count: active.length,
  };
}

export function expectedCashWithOffline(args: {
  openingCashPaise: number;
  serverCashSalesPaise: number;
  refundsPaise?: number;
  pendingOfflineCashPaise: number;
}): { serverExpectedPaise: number; combinedExpectedPaise: number } {
  const serverExpectedPaise = args.openingCashPaise + args.serverCashSalesPaise - (args.refundsPaise ?? 0);
  return {
    serverExpectedPaise,
    combinedExpectedPaise: serverExpectedPaise + args.pendingOfflineCashPaise,
  };
}

export function mergeSalesWithOffline(serverSales: SaleDTO[], offlineSales: OfflineSaleRecord[], today: string, limit?: number): MergedSaleRow[] {
  const localRows = visibleOfflineSales(offlineSales, today).map((sale) => ({
    sale: offlineSaleToDTO(sale),
    local: true,
    state: sale.syncState,
    serverSaleId: sale.serverSaleId,
    serverReceiptNo: sale.serverReceiptNo,
  }));
  const localServerIds = new Set(localRows.map((row) => row.serverSaleId).filter(Boolean));
  const serverRows = serverSales
    .filter((sale) => !localServerIds.has(sale._id))
    .map((sale) => ({ sale, local: false, state: sale.syncState, serverSaleId: sale._id }));
  const rows = [...localRows, ...serverRows].sort((a, b) => new Date(b.sale.soldAt).getTime() - new Date(a.sale.soldAt).getTime());
  return typeof limit === "number" ? rows.slice(0, limit) : rows;
}
