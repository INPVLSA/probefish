// Types
export type { PlanTier, LicenseData, LicenseValidationResult } from "./types";

// Validator
export {
  validateLicense,
  validateLicenseCached,
  clearLicenseCache,
} from "./validator";

// Features
export type {
  PlanFeatures,
  FeatureName,
  BooleanFeature,
  NumericFeature,
} from "./features";
export {
  SELF_HOSTED_FEATURES,
  CLOUD_FEATURES,
  getPlanFeatures,
  isCloudMode,
  getAllFeatureDefinitions,
} from "./features";

// Access
export type {
  OrganizationWithLicense,
  OrganizationSubscription,
  OrganizationUsage,
  LicenseStatusSummary,
} from "./access";
export {
  getOrganizationPlan,
  getOrganizationLicense,
  getOrganizationFeatures,
  hasFeature,
  getFeatureLimit,
  isWithinLimit,
  getLicenseStatus,
} from "./access";

// Guards
export {
  FeatureNotAvailableError,
  LimitExceededError,
  requireFeature,
  requireWithinLimit,
  requireWithinLimitAsync,
  createFeatureGuard,
  createLimitGuard,
  licenseErrorResponse,
  handleLicenseError,
  isLicenseError,
} from "./guards";
