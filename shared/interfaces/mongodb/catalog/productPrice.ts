export interface IProductPrice {
  _id?: string;

  orgId: string;
  productId: string;
  locationId: string;

  /** Price for ONE sale unit, in paise. */
  unitPricePaise: number;

  /** Active window. effectiveTo null => open-ended. */
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;

  createdBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
