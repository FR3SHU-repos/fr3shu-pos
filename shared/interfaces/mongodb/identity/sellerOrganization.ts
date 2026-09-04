export type SellerOrgType = "Brand" | "FPO" | "Farmer";
export type SellerOrgStatus = "PendingVerification" | "Approved" | "Suspended" | "Archived";

export interface ISellerOrganization {
  _id?: string;

  // Required
  name: string;
  type: SellerOrgType;
  status: SellerOrgStatus;

  // Optional
  legalName?: string;
  gstin?: string;
  contactEmail?: string;
  contactPhone?: string;
  settlement?: {
    bankAccountName?: string;
    bankAccountNumber?: string;
    ifsc?: string;
    upiId?: string;
  };
  verifiedBy?: string;
  verifiedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
