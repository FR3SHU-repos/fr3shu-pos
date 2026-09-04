export type PosRole = "Admin" | "Owner" | "Manager" | "Cashier" | "InventoryManager";

export interface IUser {
  _id?: string;

  // Required
  name: string;
  email: string;
  passwordHash: string;
  role: PosRole;

  // Tenant scope. Empty for a platform Admin.
  orgId?: string;
  /** Locations this user may operate. First entry is the default. */
  locationIds?: string[];

  // Optional
  phoneNumber?: string;
  isActive?: boolean;
  invitedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
