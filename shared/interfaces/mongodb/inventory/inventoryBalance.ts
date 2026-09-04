/**
 * On-hand quantity for a (location, product, lot) triple, in integer base units.
 * `availableBase` is the target of atomic conditional decrements at sale time.
 */
export interface IInventoryBalance {
  _id?: string;

  orgId: string;
  locationId: string;
  productId: string;
  lotId: string;

  availableBase: number;
  reservedBase: number;

  createdAt?: Date;
  updatedAt?: Date;
}
