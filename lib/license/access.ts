import { validateLicenseCached } from "./validator";
import {
  getPlanFeatures,
  isCloudMode,
  BooleanFeature,
  NumericFeature,
  PlanFeatures,
} from "./features";
import { PlanTier, LicenseData } from "./types";

export interface OrganizationSubscription {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: PlanTier;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd?: Date;
}

export interface OrganizationUsage {
  testRunsThisMonth: number;
  usageResetDate: Date;
}

export interface OrganizationWithLicense {
  licenseKey?: string;
  // For cloud mode, this comes from Stripe subscription
  subscription?: OrganizationSubscription;
  // Usage tracking
  usage?: OrganizationUsage;
}

/**
 * Determine the effective plan for an organization
 */
export function getOrganizationPlan(org: OrganizationWithLicense): PlanTier {
  // Cloud mode: check Stripe subscription
  if (isCloudMode() && org.subscription) {
    if (
      org.subscription.status === "active" ||
      org.subscription.status === "trialing"
    ) {
      return org.subscription.plan;
    }
    return "free"; // Lapsed subscription falls back to free
  }

  // Self-hosted mode: check license key
  if (org.licenseKey) {
    const result = validateLicenseCached(org.licenseKey);
    if (result.valid && result.license) {
      return result.license.plan;
    }
  }

  return "free";
}

/**
 * Get the active license data for an organization
 */
export function getOrganizationLicense(
  org: OrganizationWithLicense
): LicenseData | null {
  if (!org.licenseKey) return null;

  const result = validateLicenseCached(org.licenseKey);
  return result.valid ? result.license : null;
}

/**
 * Get the full feature set for an organization based on their plan
 */
export function getOrganizationFeatures(
  org: OrganizationWithLicense
): PlanFeatures {
  const plan = getOrganizationPlan(org);
  return getPlanFeatures(plan);
}

/**
 * Check if a boolean feature is enabled for an organization
 */
export function hasFeature(
  org: OrganizationWithLicense,
  feature: BooleanFeature
): boolean {
  const plan = getOrganizationPlan(org);
  const license = getOrganizationLicense(org);
  const features = getPlanFeatures(plan);

  // Check for feature override in license
  if (license?.features?.includes(feature)) {
    return true;
  }

  return features[feature] as boolean;
}

/**
 * Get the limit for a numeric feature
 */
export function getFeatureLimit(
  org: OrganizationWithLicense,
  feature: NumericFeature
): number {
  const plan = getOrganizationPlan(org);
  const license = getOrganizationLicense(org);
  const features = getPlanFeatures(plan);

  // Check for limit override in license
  if (license?.limits) {
    const limitMap: Record<string, keyof NonNullable<LicenseData["limits"]>> = {
      maxProjects: "maxProjects",
      maxTestRunsPerMonth: "maxTestRunsPerMonth",
      maxEndpoints: "maxEndpoints",
    };

    const limitKey = limitMap[feature];
    if (limitKey && license.limits[limitKey] !== undefined) {
      return license.limits[limitKey]!;
    }
  }

  return features[feature] as number;
}

/**
 * Check if organization is within a numeric limit
 */
export function isWithinLimit(
  org: OrganizationWithLicense,
  feature: NumericFeature,
  currentUsage: number
): boolean {
  const limit = getFeatureLimit(org, feature);
  return currentUsage < limit;
}

/**
 * Get license status summary for an organization
 */
export interface LicenseStatusSummary {
  plan: PlanTier;
  isLicensed: boolean;
  deploymentMode: "self-hosted" | "cloud";
  features: PlanFeatures;
  license: {
    id: string;
    expiresAt: string;
    seats: number;
    organizationName: string;
  } | null;
  subscription: OrganizationSubscription | null;
  usage: OrganizationUsage | null;
}

export function getLicenseStatus(
  org: OrganizationWithLicense
): LicenseStatusSummary {
  const plan = getOrganizationPlan(org);
  const license = getOrganizationLicense(org);
  const features = getPlanFeatures(plan);

  return {
    plan,
    isLicensed: plan !== "free",
    deploymentMode: isCloudMode() ? "cloud" : "self-hosted",
    features,
    license: license
      ? {
          id: license.id,
          expiresAt: license.expiresAt,
          seats: license.seats,
          organizationName: license.organizationName,
        }
      : null,
    subscription: org.subscription || null,
    usage: org.usage || null,
  };
}
