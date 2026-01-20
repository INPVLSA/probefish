import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOrganizationPlan,
  getOrganizationLicense,
  hasFeature,
  getFeatureLimit,
  isWithinLimit,
  getLicenseStatus,
  OrganizationWithLicense,
} from "@/lib/license/access";
import { SELF_HOSTED_FEATURES, CLOUD_FEATURES } from "@/lib/license/features";

// Mock the validator module
vi.mock("@/lib/license/validator", () => ({
  validateLicenseCached: vi.fn(),
}));

import { validateLicenseCached } from "@/lib/license/validator";

const mockValidateLicenseCached = vi.mocked(validateLicenseCached);

describe("getOrganizationPlan", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  describe("self-hosted mode", () => {
    it("should return free when no license key", () => {
      const org: OrganizationWithLicense = {};
      expect(getOrganizationPlan(org)).toBe("free");
    });

    it("should return license plan when valid license", () => {
      mockValidateLicenseCached.mockReturnValue({
        valid: true,
        license: {
          id: "test-id",
          organizationName: "Test Org",
          plan: "pro",
          seats: 10,
          issuedAt: "2024-01-01",
          expiresAt: "2025-01-01",
        },
      });

      const org: OrganizationWithLicense = { licenseKey: "valid-key" };
      expect(getOrganizationPlan(org)).toBe("pro");
    });

    it("should return free when license is invalid", () => {
      mockValidateLicenseCached.mockReturnValue({
        valid: false,
        license: null,
        error: "invalid_signature",
      });

      const org: OrganizationWithLicense = { licenseKey: "invalid-key" };
      expect(getOrganizationPlan(org)).toBe("free");
    });
  });

  describe("cloud mode", () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = "cloud";
    });

    it("should return subscription plan when subscription is active", () => {
      const org: OrganizationWithLicense = {
        subscription: {
          plan: "enterprise",
          status: "active",
        },
      };
      expect(getOrganizationPlan(org)).toBe("enterprise");
    });

    it("should return subscription plan when subscription is trialing", () => {
      const org: OrganizationWithLicense = {
        subscription: {
          plan: "pro",
          status: "trialing",
        },
      };
      expect(getOrganizationPlan(org)).toBe("pro");
    });

    it("should return free when subscription is past_due", () => {
      const org: OrganizationWithLicense = {
        subscription: {
          plan: "pro",
          status: "past_due",
        },
      };
      expect(getOrganizationPlan(org)).toBe("free");
    });

    it("should return free when subscription is canceled", () => {
      const org: OrganizationWithLicense = {
        subscription: {
          plan: "enterprise",
          status: "canceled",
        },
      };
      expect(getOrganizationPlan(org)).toBe("free");
    });

    it("should return free when no subscription", () => {
      const org: OrganizationWithLicense = {};
      expect(getOrganizationPlan(org)).toBe("free");
    });
  });
});

describe("getOrganizationLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when no license key", () => {
    const org: OrganizationWithLicense = {};
    expect(getOrganizationLicense(org)).toBeNull();
  });

  it("should return license data when valid", () => {
    const licenseData = {
      id: "test-id",
      organizationName: "Test Org",
      plan: "pro" as const,
      seats: 10,
      issuedAt: "2024-01-01",
      expiresAt: "2025-01-01",
    };

    mockValidateLicenseCached.mockReturnValue({
      valid: true,
      license: licenseData,
    });

    const org: OrganizationWithLicense = { licenseKey: "valid-key" };
    expect(getOrganizationLicense(org)).toEqual(licenseData);
  });

  it("should return null when license is invalid", () => {
    mockValidateLicenseCached.mockReturnValue({
      valid: false,
      license: null,
      error: "expired",
    });

    const org: OrganizationWithLicense = { licenseKey: "expired-key" };
    expect(getOrganizationLicense(org)).toBeNull();
  });
});

describe("hasFeature", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  it("should return true for self-hosted free plan with webhooks", () => {
    const org: OrganizationWithLicense = {};
    expect(hasFeature(org, "webhooks")).toBe(true);
    expect(hasFeature(org, "apiAccess")).toBe(true);
  });

  it("should return false for self-hosted free plan with SSO", () => {
    const org: OrganizationWithLicense = {};
    expect(hasFeature(org, "sso")).toBe(false);
    expect(hasFeature(org, "auditLog")).toBe(false);
  });

  it("should return true for enterprise features on enterprise plan", () => {
    mockValidateLicenseCached.mockReturnValue({
      valid: true,
      license: {
        id: "test-id",
        organizationName: "Test Org",
        plan: "enterprise",
        seats: 10,
        issuedAt: "2024-01-01",
        expiresAt: "2025-01-01",
      },
    });

    const org: OrganizationWithLicense = { licenseKey: "enterprise-key" };
    expect(hasFeature(org, "sso")).toBe(true);
    expect(hasFeature(org, "auditLog")).toBe(true);
  });

  it("should honor feature overrides in license", () => {
    mockValidateLicenseCached.mockReturnValue({
      valid: true,
      license: {
        id: "test-id",
        organizationName: "Test Org",
        plan: "pro",
        seats: 10,
        issuedAt: "2024-01-01",
        expiresAt: "2025-01-01",
        features: ["sso"], // Override: SSO enabled on pro plan
      },
    });

    const org: OrganizationWithLicense = { licenseKey: "custom-key" };
    expect(hasFeature(org, "sso")).toBe(true); // Overridden
    expect(hasFeature(org, "auditLog")).toBe(false); // Not overridden
  });
});

describe("getFeatureLimit", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  it("should return Infinity for self-hosted free plan", () => {
    const org: OrganizationWithLicense = {};
    expect(getFeatureLimit(org, "maxProjects")).toBe(Infinity);
    expect(getFeatureLimit(org, "maxTestRunsPerMonth")).toBe(Infinity);
  });

  it("should return cloud limits for cloud free plan", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const org: OrganizationWithLicense = {};
    expect(getFeatureLimit(org, "maxProjects")).toBe(3);
    expect(getFeatureLimit(org, "maxTestRunsPerMonth")).toBe(100);
  });

  it("should honor limit overrides in license", () => {
    mockValidateLicenseCached.mockReturnValue({
      valid: true,
      license: {
        id: "test-id",
        organizationName: "Test Org",
        plan: "pro",
        seats: 10,
        issuedAt: "2024-01-01",
        expiresAt: "2025-01-01",
        limits: {
          maxProjects: 100,
          maxTestRunsPerMonth: 50000,
        },
      },
    });

    const org: OrganizationWithLicense = { licenseKey: "custom-key" };
    expect(getFeatureLimit(org, "maxProjects")).toBe(100);
    expect(getFeatureLimit(org, "maxTestRunsPerMonth")).toBe(50000);
  });
});

describe("isWithinLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
  });

  it("should return true when usage is below limit", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(isWithinLimit(org, "maxProjects", 2)).toBe(true);
  });

  it("should return false when usage equals limit", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(isWithinLimit(org, "maxProjects", 3)).toBe(false);
  });

  it("should return false when usage exceeds limit", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(isWithinLimit(org, "maxProjects", 5)).toBe(false);
  });

  it("should always return true for unlimited features", () => {
    delete process.env.DEPLOYMENT_MODE;
    const org: OrganizationWithLicense = {};
    // Self-hosted free: unlimited
    expect(isWithinLimit(org, "maxProjects", 999999)).toBe(true);
  });
});

describe("getLicenseStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
  });

  it("should return complete status for free plan", () => {
    const org: OrganizationWithLicense = {
      usage: {
        testRunsThisMonth: 50,
        usageResetDate: new Date(),
      },
    };

    const status = getLicenseStatus(org);

    expect(status.plan).toBe("free");
    expect(status.isLicensed).toBe(false);
    expect(status.license).toBeNull();
    expect(status.subscription).toBeNull();
    expect(status.usage).toEqual(org.usage);
    expect(status.features).toEqual(SELF_HOSTED_FEATURES.free);
  });

  it("should return complete status for licensed plan", () => {
    const licenseData = {
      id: "test-id",
      organizationName: "Test Org",
      plan: "enterprise" as const,
      seats: 50,
      issuedAt: "2024-01-01",
      expiresAt: "2025-01-01",
    };

    mockValidateLicenseCached.mockReturnValue({
      valid: true,
      license: licenseData,
    });

    const org: OrganizationWithLicense = { licenseKey: "valid-key" };
    const status = getLicenseStatus(org);

    expect(status.plan).toBe("enterprise");
    expect(status.isLicensed).toBe(true);
    expect(status.license).toEqual({
      id: licenseData.id,
      expiresAt: licenseData.expiresAt,
      seats: licenseData.seats,
      organizationName: licenseData.organizationName,
    });
    expect(status.features).toEqual(SELF_HOSTED_FEATURES.enterprise);
  });
});
