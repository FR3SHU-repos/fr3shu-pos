export type PosSessionStatus = "open" | "closed";

/** Running money tallies for a register shift, all in paise. */
export interface PosSessionTotals {
  cashSalesPaise: number;
  upiSalesPaise: number;
  cardSalesPaise: number;
  refundsPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  saleCount: number;
}

export interface IPosSession {
  _id?: string;

  orgId: string;
  locationId: string;
  registerId: string;

  openedBy: string;
  openedAt: Date;
  openingCashPaise: number;

  status: PosSessionStatus;
  totals: PosSessionTotals;

  // Close
  closedBy?: string;
  closedAt?: Date;
  expectedCashPaise?: number;
  countedCashPaise?: number;
  cashVariancePaise?: number;
  varianceNote?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
