/**
 * Organic verification record. A product is only sellable "as verified organic"
 * when its certification is Approved and within its validity window.
 * PendingVerification / Expired / Rejected / InConversion do NOT confer verified status.
 */
export type CertScheme =
  | "NPOP"
  | "PGSIndia"
  | "InConversion"
  | "OtherCertified"
  | "PendingVerification"
  | "Expired"
  | "Rejected";

export type CertVerificationStatus =
  | "PendingVerification"
  | "Approved"
  | "Rejected"
  | "Expired";

export interface ICertification {
  _id?: string;

  // Required
  orgId: string;
  scheme: CertScheme;
  verificationStatus: CertVerificationStatus;

  // Source
  farmOrProducerId?: string;
  certificateNumber?: string;
  certifyingBody?: string;
  scope?: string;
  coveredCategories?: string[];

  // Validity
  issueDate?: Date;
  validFrom?: Date;
  validUntil?: Date;

  // Document
  documentUrl?: string;
  documentMeta?: { filename?: string; mimeType?: string; sizeBytes?: number };

  // Verification trail
  verifiedBy?: string;
  verifiedAt?: Date;
  verifierNotes?: string;
  history?: Array<{
    at: Date;
    actorId: string;
    action: string;
    note?: string;
  }>;

  createdAt?: Date;
  updatedAt?: Date;
}

/** Immutable snapshot copied onto a Lot / Sale item at capture time. */
export interface CertificationSnapshot {
  certificationId?: string;
  scheme?: CertScheme;
  verificationStatus?: CertVerificationStatus;
  certificateNumber?: string;
  certifyingBody?: string;
  validUntil?: Date | string;
  isVerifiedOrganic: boolean;
}
