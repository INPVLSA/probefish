import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FeatureNotAvailableError,
  LimitExceededError,
  requireFeature,
  requireWithinLimit,
  requireWithinLimitAsync,
  licenseErrorResponse,
  isLicenseError,
} from "@/lib/license/guards";
import { OrganizationWithLicense } from "@/lib/license/access";

// Mock the validator module
vi.mock("@/lib/license/validator", () => ({
  validateLicenseCached: vi.fn(),
}));

import { validateLicenseCached } from "@/lib/license/validator";

const mockValidateLicenseCached = vi.mocked(validateLicenseCached);

describe("FeatureNotAvailableError", () => {
  it("should create error with correct properties", () => {
    const error = new FeatureNotAvailableError("sso", "free", "enterprise");

    expect(error.name).toBe("FeatureNotAvailableError");
    expect(error.feature).toBe("sso");
    expect(error.currentPlan).toBe("free");
    expect(error.requiredPlan).toBe("enterprise");
    expect(error.message).toContain("sso");
    expect(error.message).toContain("enterprise");
  });

  it("should default requiredPlan to pro", () => {
    const error = new FeatureNotAvailableError("webhooks", "free");

    expect(error.requiredPlan).toBe("pro");
  });
});

describe("LimitExceededError", () => {
  it("should create error with correct properties", () => {
    const error = new LimitExceededError("maxProjects", 10, 15);

    expect(error.name).toBe("LimitExceededError");
    expect(error.feature).toBe("maxProjects");
    expect(error.limit).toBe(10);
    expect(error.current).toBe(15);
    expect(error.message).toContain("maxProjects");
    expect(error.message).toContain("15/10");
  });
});

describe("requireFeature", () => {
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

  it("should not throw for available features on free self-hosted", () => {
    const org: OrganizationWithLicense = {};

    // webhooks and apiAccess are free on self-hosted
    expect(() => requireFeature(org, "webhooks")).not.toThrow();
    expect(() => requireFeature(org, "apiAccess")).not.toThrow();
  });

  it("should throw for SSO on free plan", () => {
    const org: OrganizationWithLicense = {};

    expect(() => requireFeature(org, "sso")).toThrow(FeatureNotAvailableError);
    expect(() => requireFeature(org, "sso")).toThrow(/sso/);
  });

  it("should not throw for SSO on enterprise plan", () => {
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

    expect(() => requireFeature(org, "sso")).not.toThrow();
  });

  it("should throw for apiAccess on cloud free plan", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const org: OrganizationWithLicense = {};

    expect(() => requireFeature(org, "apiAccess")).toThrow(
      FeatureNotAvailableError
    );
  });
});

describe("requireWithinLimit", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEPLOYMENT_MODE = "cloud";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  it("should not throw when within limit", () => {
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(() => requireWithinLimit(org, "maxProjects", 2)).not.toThrow();
  });

  it("should throw when at limit", () => {
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(() => requireWithinLimit(org, "maxProjects", 3)).toThrow(
      LimitExceededError
    );
  });

  it("should throw when over limit", () => {
    const org: OrganizationWithLicense = {};
    // Cloud free: maxProjects = 3
    expect(() => requireWithinLimit(org, "maxProjects", 5)).toThrow(
      LimitExceededError
    );
  });

  it("should include correct values in error", () => {
    const org: OrganizationWithLicense = {};

    try {
      requireWithinLimit(org, "maxProjects", 5);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LimitExceededError);
      const limitError = error as LimitExceededError;
      expect(limitError.limit).toBe(3);
      expect(limitError.current).toBe(5);
    }
  });
});

describe("requireWithinLimitAsync", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEPLOYMENT_MODE = "cloud";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  it("should not throw when async usage is within limit", async () => {
    const org: OrganizationWithLicense = {};

    await expect(
      requireWithinLimitAsync(org, "maxProjects", async () => 2)
    ).resolves.toBeUndefined();
  });

  it("should throw when async usage exceeds limit", async () => {
    const org: OrganizationWithLicense = {};

    await expect(
      requireWithinLimitAsync(org, "maxProjects", async () => 5)
    ).rejects.toThrow(LimitExceededError);
  });

  it("should work with sync getter function", async () => {
    const org: OrganizationWithLicense = {};

    await expect(
      requireWithinLimitAsync(org, "maxProjects", () => 1)
    ).resolves.toBeUndefined();
  });
});

describe("licenseErrorResponse", () => {
  it("should return 403 response for FeatureNotAvailableError", () => {
    const error = new FeatureNotAvailableError("sso", "free", "enterprise");
    const response = licenseErrorResponse(error);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it("should include feature info in FeatureNotAvailableError response", async () => {
    const error = new FeatureNotAvailableError("sso", "free", "enterprise");
    const response = licenseErrorResponse(error);
    const body = await response!.json();

    expect(body.code).toBe("FEATURE_NOT_AVAILABLE");
    expect(body.feature).toBe("sso");
    expect(body.currentPlan).toBe("free");
    expect(body.requiredPlan).toBe("enterprise");
    expect(body.upgrade).toBe(true);
  });

  it("should return 403 response for LimitExceededError", () => {
    const error = new LimitExceededError("maxProjects", 3, 5);
    const response = licenseErrorResponse(error);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it("should include limit info in LimitExceededError response", async () => {
    const error = new LimitExceededError("maxProjects", 3, 5);
    const response = licenseErrorResponse(error);
    const body = await response!.json();

    expect(body.code).toBe("LIMIT_EXCEEDED");
    expect(body.feature).toBe("maxProjects");
    expect(body.limit).toBe(3);
    expect(body.current).toBe(5);
    expect(body.upgrade).toBe(true);
  });

  it("should return null for non-license errors", () => {
    const error = new Error("Some other error");
    const response = licenseErrorResponse(error);

    expect(response).toBeNull();
  });

  it("should return null for non-errors", () => {
    expect(licenseErrorResponse("string")).toBeNull();
    expect(licenseErrorResponse(null)).toBeNull();
    expect(licenseErrorResponse(undefined)).toBeNull();
  });
});

describe("isLicenseError", () => {
  it("should return true for FeatureNotAvailableError", () => {
    const error = new FeatureNotAvailableError("sso", "free");
    expect(isLicenseError(error)).toBe(true);
  });

  it("should return true for LimitExceededError", () => {
    const error = new LimitExceededError("maxProjects", 3, 5);
    expect(isLicenseError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("regular error");
    expect(isLicenseError(error)).toBe(false);
  });

  it("should return false for non-errors", () => {
    expect(isLicenseError("string")).toBe(false);
    expect(isLicenseError(null)).toBe(false);
    expect(isLicenseError(undefined)).toBe(false);
    expect(isLicenseError({})).toBe(false);
  });
});
