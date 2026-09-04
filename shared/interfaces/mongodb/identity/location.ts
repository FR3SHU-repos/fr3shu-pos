export type LocationStatus = "active" | "archived";

export interface ILocation {
  _id?: string;

  // Required
  orgId: string;
  name: string;
  code: string;
  status: LocationStatus;

  // Optional
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  gstin?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
