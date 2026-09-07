// POS identity types. Authentication is now Supabase Auth (see
// shared/lib/supabase/*); this file keeps only the role/org type vocabulary
// that shared/lib/api and UI code reference. There is no local token handling.

export type PosRole =
  | "Admin"
  | "Owner"
  | "Manager"
  | "Cashier"
  | "InventoryManager"
  | "StoreOwner"
  | "StoreManager"
  | "SellerOwner"
  | "Member";

export type SellerOrgType = "Brand" | "FPO" | "Farmer" | "Retailer";

export interface PosTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: PosRole;
  orgId: string;
  orgType: SellerOrgType | "Platform";
  locationId: string;
}
