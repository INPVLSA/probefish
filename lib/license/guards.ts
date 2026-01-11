import { NextResponse } from "next/server";
import {
  OrganizationWithLicense,
  hasFeature,
  isWithinLimit,
  getFeatureLimit,
  getOrganizationPlan,
} from "./access";
import { BooleanFeature, NumericFeature } from "./features";

/**
 * Error thrown when a feature requires a higher plan
 */
export class FeatureNotAvailableError extends Error {
  public readonly feature: string;
  public readonly requiredPlan: string;
  public readonly currentPlan: string;

  constructor(
    feature: string,
    currentPlan: string,
    requiredPlan: string = "pro"
  ) {
    super(`Feature "${feature}" requires ${requiredPlan} plan or higher`);
    this.name = "FeatureNotAvailableError";
    this.feature = feature;
    this.requiredPlan = requiredPlan;
    this.currentPlan = currentPlan;
  }
}

/**
 * Error thrown when a usage limit is exceeded
 */
export class LimitExceededError extends Error {
  public readonly feature: string;
  public readonly limit: number;
  public readonly current: number;

  constructor(feature: string, limit: number, current: number) {
    super(`Limit exceeded for "${feature}": ${current}/${limit}`);
    this.name = "LimitExceededError";
    this.feature = feature;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Feature requirement mapping - which plan unlocks each feature
 */
const FEATURE_REQUIRED_PLAN: Record<BooleanFeature, string> = {
  apiAccess: "pro",
  webhooks: "pro",
  advancedAnalytics: "pro",
  prioritySupport: "pro",
  sso: "enterprise",
  auditLog: "enterprise",
  customBranding: "enterprise",
};

/**
 * Check if a boolean feature is enabled, throw if not
 */
export function requireFeature(
  org: OrganizationWithLicense,
  feature: BooleanFeature
): void {
  if (!hasFeature(org, feature)) {
    const currentPlan = getOrganizationPlan(org);
    const requiredPlan = FEATURE_REQUIRED_PLAN[feature] || "pro";
    throw new FeatureNotAvailableError(feature, currentPlan, requiredPlan);
  }
}

/**
 * Check if usage is within a numeric limit, throw if not
 */
export function requireWithinLimit(
  org: OrganizationWithLicense,
  feature: NumericFeature,
  currentUsage: number
): void {
  const limit = getFeatureLimit(org, feature);

  if (!isWithinLimit(org, feature, currentUsage)) {
    throw new LimitExceededError(feature, limit, currentUsage);
  }
}

/**
 * Async version of requireWithinLimit that accepts a usage getter
 */
export async function requireWithinLimitAsync(
  org: OrganizationWithLicense,
  feature: NumericFeature,
  getCurrentUsage: () => number | Promise<number>
): Promise<void> {
  const limit = getFeatureLimit(org, feature);
  const current = await getCurrentUsage();

  if (current >= limit) {
    throw new LimitExceededError(feature, limit, current);
  }
}

/**
 * Create a guard function for a specific boolean feature
 */
export function createFeatureGuard(feature: BooleanFeature) {
  return (org: OrganizationWithLicense) => {
    requireFeature(org, feature);
  };
}

/**
 * Create a guard function for a specific numeric limit
 */
export function createLimitGuard(
  feature: NumericFeature,
  getCurrentUsage: (org: OrganizationWithLicense) => number | Promise<number>
) {
  return async (org: OrganizationWithLicense) => {
    const currentUsage = await getCurrentUsage(org);
    requireWithinLimit(org, feature, currentUsage);
  };
}

/**
 * Convert license errors to NextResponse
 */
export function licenseErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof FeatureNotAvailableError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "FEATURE_NOT_AVAILABLE",
        feature: error.feature,
        currentPlan: error.currentPlan,
        requiredPlan: error.requiredPlan,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  if (error instanceof LimitExceededError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "LIMIT_EXCEEDED",
        feature: error.feature,
        limit: error.limit,
        current: error.current,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  // Not a license error, return null so caller can handle it
  return null;
}

/**
 * Helper to check license errors in a try-catch block
 */
export function handleLicenseError(error: unknown): NextResponse {
  const licenseResponse = licenseErrorResponse(error);
  if (licenseResponse) {
    return licenseResponse;
  }
  // Re-throw non-license errors
  throw error;
}

/**
 * Type guard to check if an error is a license-related error
 */
export function isLicenseError(
  error: unknown
): error is FeatureNotAvailableError | LimitExceededError {
  return (
    error instanceof FeatureNotAvailableError ||
    error instanceof LimitExceededError
  );
}
