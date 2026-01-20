import { describe, it, expect, beforeEach } from "vitest";
import {
  validateLicense,
  validateLicenseCached,
  clearLicenseCache,
} from "@/lib/license/validator";

describe("validateLicense", () => {
  describe("input validation", () => {
    it("should return not_found error for empty license key", () => {
      const result = validateLicense("");
      expect(result.valid).toBe(false);
      expect(result.license).toBeNull();
      expect(result.error).toBe("not_found");
    });

    it("should return not_found error for undefined/null", () => {
      // @ts-expect-error testing invalid input
      const result1 = validateLicense(undefined);
      // @ts-expect-error testing invalid input
      const result2 = validateLicense(null);
      expect(result1.error).toBe("not_found");
      expect(result2.error).toBe("not_found");
    });

    it("should return malformed error for invalid format (no dot separator)", () => {
      const result = validateLicense("invalid-license-key-format");
      expect(result.valid).toBe(false);
      expect(result.license).toBeNull();
      expect(result.error).toBe("malformed");
    });

    it("should return malformed error for too many parts", () => {
      const result = validateLicense("part1.part2.part3");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("malformed");
    });

    it("should return invalid_signature error for invalid base64 in payload", () => {
      // Note: Buffer.from with 'base64' doesn't throw for invalid input,
      // it just decodes what it can. Signature verification fails first.
      const result = validateLicense("!!!invalid-base64!!!.c2lnbmF0dXJl");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_signature");
    });

    it("should return invalid_signature error for non-JSON payload", () => {
      // Signature verification happens before JSON parsing (correct security behavior)
      const payload = Buffer.from("not json").toString("base64");
      const sig = Buffer.from("signature").toString("base64");
      const result = validateLicense(`${payload}.${sig}`);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_signature");
    });
  });

  describe("signature verification", () => {
    it("should return invalid_signature or malformed for random signature", () => {
      const payload = Buffer.from(
        JSON.stringify({
          id: "test-id",
          organizationName: "Test",
          plan: "pro",
          seats: 10,
          issuedAt: "2024-01-01",
          expiresAt: "2030-01-01",
        }),
        "utf-8"
      ).toString("base64");

      // Random bytes as signature
      const fakeSignature = Buffer.from("random-fake-signature").toString(
        "base64"
      );
      const result = validateLicense(`${payload}.${fakeSignature}`);

      // Should fail signature verification (either malformed or invalid_signature)
      expect(result.valid).toBe(false);
      expect(["malformed", "invalid_signature"]).toContain(result.error);
    });
  });
});

describe("validateLicenseCached", () => {
  beforeEach(() => {
    clearLicenseCache();
  });

  it("should return same result for same invalid key", () => {
    const result1 = validateLicenseCached("invalid-key");
    const result2 = validateLicenseCached("invalid-key");

    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(false);
    expect(result1.error).toBe(result2.error);
  });

  it("should return different results for different keys", () => {
    const result1 = validateLicenseCached("key1");
    const result2 = validateLicenseCached("key2.sig2");

    // Both are invalid but for different reasons
    // key1 has no dot separator -> malformed
    // key2.sig2 has valid format but invalid signature -> invalid_signature
    expect(result1.error).toBe("malformed");
    expect(result2.error).toBe("invalid_signature");
  });

  it("should cache results for repeated calls", () => {
    // First call
    const result1 = validateLicenseCached("test.key");

    // Second call should return cached result
    const result2 = validateLicenseCached("test.key");

    expect(result1).toEqual(result2);
  });
});

describe("clearLicenseCache", () => {
  beforeEach(() => {
    clearLicenseCache();
  });

  it("should allow clearing specific key from cache", () => {
    // Populate cache
    validateLicenseCached("key1");
    validateLicenseCached("key2");

    // Clear specific key - should not throw
    expect(() => clearLicenseCache("key1")).not.toThrow();
  });

  it("should allow clearing entire cache", () => {
    // Populate cache
    validateLicenseCached("key1");
    validateLicenseCached("key2");

    // Clear all - should not throw
    expect(() => clearLicenseCache()).not.toThrow();
  });

  it("should handle clearing non-existent key", () => {
    expect(() => clearLicenseCache("non-existent-key")).not.toThrow();
  });
});

describe("LicenseValidationResult structure", () => {
  it("should return valid: false for invalid keys", () => {
    const result = validateLicense("invalid");
    expect(result.valid).toBe(false);
    expect(result.license).toBeNull();
    expect(result.error).toBeDefined();
  });

  it("should have correct error types", () => {
    // Test different error scenarios
    const emptyResult = validateLicense("");
    expect(emptyResult.error).toBe("not_found");

    const malformedResult = validateLicense("no-dot-separator");
    expect(malformedResult.error).toBe("malformed");
  });
});
