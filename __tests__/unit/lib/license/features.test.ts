import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SELF_HOSTED_FEATURES,
  CLOUD_FEATURES,
  getPlanFeatures,
  isCloudMode,
} from "@/lib/license/features";

describe("SELF_HOSTED_FEATURES", () => {
  describe("free plan", () => {
    it("should have unlimited core features", () => {
      expect(SELF_HOSTED_FEATURES.free.maxProjects).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.free.maxTestRunsPerMonth).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.free.maxTeamMembers).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.free.maxEndpoints).toBe(Infinity);
    });

    it("should have API access and webhooks enabled", () => {
      expect(SELF_HOSTED_FEATURES.free.apiAccess).toBe(true);
      expect(SELF_HOSTED_FEATURES.free.webhooks).toBe(true);
    });

    it("should have enterprise features disabled", () => {
      expect(SELF_HOSTED_FEATURES.free.sso).toBe(false);
      expect(SELF_HOSTED_FEATURES.free.auditLog).toBe(false);
      expect(SELF_HOSTED_FEATURES.free.customBranding).toBe(false);
      expect(SELF_HOSTED_FEATURES.free.advancedAnalytics).toBe(false);
      expect(SELF_HOSTED_FEATURES.free.prioritySupport).toBe(false);
    });
  });

  describe("pro plan", () => {
    it("should have unlimited core features", () => {
      expect(SELF_HOSTED_FEATURES.pro.maxProjects).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.pro.maxTestRunsPerMonth).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.pro.maxTeamMembers).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.pro.maxEndpoints).toBe(Infinity);
    });

    it("should have pro features enabled", () => {
      expect(SELF_HOSTED_FEATURES.pro.apiAccess).toBe(true);
      expect(SELF_HOSTED_FEATURES.pro.webhooks).toBe(true);
      expect(SELF_HOSTED_FEATURES.pro.advancedAnalytics).toBe(true);
      expect(SELF_HOSTED_FEATURES.pro.prioritySupport).toBe(true);
    });

    it("should have enterprise-only features disabled", () => {
      expect(SELF_HOSTED_FEATURES.pro.sso).toBe(false);
      expect(SELF_HOSTED_FEATURES.pro.auditLog).toBe(false);
      expect(SELF_HOSTED_FEATURES.pro.customBranding).toBe(false);
    });
  });

  describe("enterprise plan", () => {
    it("should have all features enabled", () => {
      expect(SELF_HOSTED_FEATURES.enterprise.maxProjects).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.enterprise.maxTestRunsPerMonth).toBe(
        Infinity
      );
      expect(SELF_HOSTED_FEATURES.enterprise.maxTeamMembers).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.enterprise.maxEndpoints).toBe(Infinity);
      expect(SELF_HOSTED_FEATURES.enterprise.apiAccess).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.webhooks).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.sso).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.auditLog).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.customBranding).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.advancedAnalytics).toBe(true);
      expect(SELF_HOSTED_FEATURES.enterprise.prioritySupport).toBe(true);
    });
  });
});

describe("CLOUD_FEATURES", () => {
  describe("free plan", () => {
    it("should have limited resources", () => {
      expect(CLOUD_FEATURES.free.maxProjects).toBe(3);
      expect(CLOUD_FEATURES.free.maxTestRunsPerMonth).toBe(100);
      expect(CLOUD_FEATURES.free.maxTeamMembers).toBe(2);
      expect(CLOUD_FEATURES.free.maxEndpoints).toBe(1);
    });

    it("should have most features disabled", () => {
      expect(CLOUD_FEATURES.free.apiAccess).toBe(false);
      expect(CLOUD_FEATURES.free.webhooks).toBe(false);
      expect(CLOUD_FEATURES.free.sso).toBe(false);
      expect(CLOUD_FEATURES.free.auditLog).toBe(false);
      expect(CLOUD_FEATURES.free.customBranding).toBe(false);
      expect(CLOUD_FEATURES.free.advancedAnalytics).toBe(false);
      expect(CLOUD_FEATURES.free.prioritySupport).toBe(false);
    });
  });

  describe("pro plan", () => {
    it("should have higher limits", () => {
      expect(CLOUD_FEATURES.pro.maxProjects).toBe(25);
      expect(CLOUD_FEATURES.pro.maxTestRunsPerMonth).toBe(10_000);
      expect(CLOUD_FEATURES.pro.maxTeamMembers).toBe(15);
      expect(CLOUD_FEATURES.pro.maxEndpoints).toBe(10);
    });

    it("should have pro features enabled", () => {
      expect(CLOUD_FEATURES.pro.apiAccess).toBe(true);
      expect(CLOUD_FEATURES.pro.webhooks).toBe(true);
      expect(CLOUD_FEATURES.pro.advancedAnalytics).toBe(true);
      expect(CLOUD_FEATURES.pro.prioritySupport).toBe(true);
    });

    it("should have enterprise-only features disabled", () => {
      expect(CLOUD_FEATURES.pro.sso).toBe(false);
      expect(CLOUD_FEATURES.pro.auditLog).toBe(false);
      expect(CLOUD_FEATURES.pro.customBranding).toBe(false);
    });
  });

  describe("enterprise plan", () => {
    it("should have unlimited resources", () => {
      expect(CLOUD_FEATURES.enterprise.maxProjects).toBe(Infinity);
      expect(CLOUD_FEATURES.enterprise.maxTestRunsPerMonth).toBe(Infinity);
      expect(CLOUD_FEATURES.enterprise.maxTeamMembers).toBe(Infinity);
      expect(CLOUD_FEATURES.enterprise.maxEndpoints).toBe(Infinity);
    });

    it("should have all features enabled", () => {
      expect(CLOUD_FEATURES.enterprise.apiAccess).toBe(true);
      expect(CLOUD_FEATURES.enterprise.webhooks).toBe(true);
      expect(CLOUD_FEATURES.enterprise.sso).toBe(true);
      expect(CLOUD_FEATURES.enterprise.auditLog).toBe(true);
      expect(CLOUD_FEATURES.enterprise.customBranding).toBe(true);
      expect(CLOUD_FEATURES.enterprise.advancedAnalytics).toBe(true);
      expect(CLOUD_FEATURES.enterprise.prioritySupport).toBe(true);
    });
  });
});

describe("isCloudMode", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  it("should return true when DEPLOYMENT_MODE is cloud", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    expect(isCloudMode()).toBe(true);
  });

  it("should return false when DEPLOYMENT_MODE is self-hosted", () => {
    process.env.DEPLOYMENT_MODE = "self-hosted";
    expect(isCloudMode()).toBe(false);
  });

  it("should return false when DEPLOYMENT_MODE is not set", () => {
    delete process.env.DEPLOYMENT_MODE;
    expect(isCloudMode()).toBe(false);
  });
});

describe("getPlanFeatures", () => {
  const originalEnv = process.env.DEPLOYMENT_MODE;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEPLOYMENT_MODE = originalEnv;
    } else {
      delete process.env.DEPLOYMENT_MODE;
    }
  });

  describe("in self-hosted mode", () => {
    beforeEach(() => {
      delete process.env.DEPLOYMENT_MODE;
    });

    it("should return self-hosted features for free plan", () => {
      const features = getPlanFeatures("free");
      expect(features).toEqual(SELF_HOSTED_FEATURES.free);
      expect(features.maxProjects).toBe(Infinity);
      expect(features.apiAccess).toBe(true);
    });

    it("should return self-hosted features for pro plan", () => {
      const features = getPlanFeatures("pro");
      expect(features).toEqual(SELF_HOSTED_FEATURES.pro);
      expect(features.advancedAnalytics).toBe(true);
    });

    it("should return self-hosted features for enterprise plan", () => {
      const features = getPlanFeatures("enterprise");
      expect(features).toEqual(SELF_HOSTED_FEATURES.enterprise);
      expect(features.sso).toBe(true);
    });
  });

  describe("in cloud mode", () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = "cloud";
    });

    it("should return cloud features for free plan", () => {
      const features = getPlanFeatures("free");
      expect(features).toEqual(CLOUD_FEATURES.free);
      expect(features.maxProjects).toBe(3);
      expect(features.apiAccess).toBe(false);
    });

    it("should return cloud features for pro plan", () => {
      const features = getPlanFeatures("pro");
      expect(features).toEqual(CLOUD_FEATURES.pro);
      expect(features.maxProjects).toBe(25);
    });

    it("should return cloud features for enterprise plan", () => {
      const features = getPlanFeatures("enterprise");
      expect(features).toEqual(CLOUD_FEATURES.enterprise);
      expect(features.sso).toBe(true);
    });
  });
});
