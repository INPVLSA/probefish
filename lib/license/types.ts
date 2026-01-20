export type PlanTier = "free" | "pro" | "enterprise";

export interface LicenseData {
  // Unique license identifier
  id: string;

  // Licensed organization (for display/verification)
  organizationName: string;
  organizationId?: string; // Optional: lock to specific org

  // Plan details
  plan: PlanTier;
  seats: number; // Max team members

  // Feature overrides (optional, for custom deals)
  features?: string[];
  limits?: {
    maxProjects?: number;
    maxTestRunsPerMonth?: number;
    maxEndpoints?: number;
  };

  // Validity
  issuedAt: string; // ISO date
  expiresAt: string; // ISO date

  // Metadata
  issuedBy?: string;
  customerEmail?: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  license: LicenseData | null;
  error?: "invalid_signature" | "expired" | "malformed" | "not_found";
}
