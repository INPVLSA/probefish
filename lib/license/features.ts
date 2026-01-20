import { PlanTier } from "./types";

/**
 * Plan feature definition structure
 */
export interface PlanFeatures {
  // Numeric limits
  maxProjects: number;
  maxTestRunsPerMonth: number;
  maxTeamMembers: number;
  maxEndpoints: number;
  // Boolean features
  apiAccess: boolean;
  webhooks: boolean;
  sso: boolean;
  auditLog: boolean;
  customBranding: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

/**
 * SELF-HOSTED FEATURES
 * Core product is unlimited - only enterprise features are gated
 */
export const SELF_HOSTED_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    // Core features - ALL UNLIMITED
    maxProjects: Infinity,
    maxTestRunsPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxEndpoints: Infinity,
    apiAccess: true,
    webhooks: true,
    // Enterprise features - GATED
    sso: false,
    auditLog: false,
    customBranding: false,
    advancedAnalytics: false,
    prioritySupport: false,
  },
  pro: {
    // Same as free for core
    maxProjects: Infinity,
    maxTestRunsPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxEndpoints: Infinity,
    apiAccess: true,
    webhooks: true,
    // Pro unlocks
    sso: false,
    auditLog: false,
    customBranding: false,
    advancedAnalytics: true,
    prioritySupport: true,
  },
  enterprise: {
    // Everything unlimited/enabled
    maxProjects: Infinity,
    maxTestRunsPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxEndpoints: Infinity,
    apiAccess: true,
    webhooks: true,
    sso: true,
    auditLog: true,
    customBranding: true,
    advancedAnalytics: true,
    prioritySupport: true,
  },
};

/**
 * CLOUD FEATURES
 * Tiered limits to control infrastructure costs
 */
export const CLOUD_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    maxProjects: 3,
    maxTestRunsPerMonth: 100,
    maxTeamMembers: 2,
    maxEndpoints: 1,
    apiAccess: false,
    webhooks: false,
    sso: false,
    auditLog: false,
    customBranding: false,
    advancedAnalytics: false,
    prioritySupport: false,
  },
  pro: {
    maxProjects: 25,
    maxTestRunsPerMonth: 10_000,
    maxTeamMembers: 15,
    maxEndpoints: 10,
    apiAccess: true,
    webhooks: true,
    sso: false,
    auditLog: false,
    customBranding: false,
    advancedAnalytics: true,
    prioritySupport: true,
  },
  enterprise: {
    maxProjects: Infinity,
    maxTestRunsPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxEndpoints: Infinity,
    apiAccess: true,
    webhooks: true,
    sso: true,
    auditLog: true,
    customBranding: true,
    advancedAnalytics: true,
    prioritySupport: true,
  },
};

/**
 * Type utilities for feature names
 */
export type FeatureName = keyof PlanFeatures;

export type BooleanFeature = {
  [K in FeatureName]: PlanFeatures[K] extends boolean ? K : never;
}[FeatureName];

export type NumericFeature = {
  [K in FeatureName]: PlanFeatures[K] extends number ? K : never;
}[FeatureName];

/**
 * Check if running in cloud deployment mode
 */
export function isCloudMode(): boolean {
  return process.env.DEPLOYMENT_MODE === "cloud";
}

/**
 * Get features based on deployment mode and plan
 */
export function getPlanFeatures(plan: PlanTier): PlanFeatures {
  const features = isCloudMode() ? CLOUD_FEATURES : SELF_HOSTED_FEATURES;
  return features[plan];
}

/**
 * Get all features for display purposes
 */
export function getAllFeatureDefinitions(): {
  selfHosted: Record<PlanTier, PlanFeatures>;
  cloud: Record<PlanTier, PlanFeatures>;
} {
  return {
    selfHosted: SELF_HOSTED_FEATURES,
    cloud: CLOUD_FEATURES,
  };
}
