import * as crypto from "crypto";
import { LicenseData, LicenseValidationResult } from "./types";

// Public key embedded in the application
// Private key stays on your license generation server
const PUBLIC_KEY =
  process.env.LICENSE_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0example0000000000
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000AQAB
-----END PUBLIC KEY-----`;

export function validateLicense(licenseKey: string): LicenseValidationResult {
  if (!licenseKey) {
    return { valid: false, license: null, error: "not_found" };
  }

  try {
    // License format: base64(payload).base64(signature)
    const parts = licenseKey.split(".");
    if (parts.length !== 2) {
      return { valid: false, license: null, error: "malformed" };
    }

    const [encodedPayload, encodedSignature] = parts;
    const payload = Buffer.from(encodedPayload, "base64");
    const signature = Buffer.from(encodedSignature, "base64");

    // Verify cryptographic signature
    const isValid = crypto.verify(
      "sha256",
      payload,
      {
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      },
      signature
    );

    if (!isValid) {
      return { valid: false, license: null, error: "invalid_signature" };
    }

    // Parse license data
    const license: LicenseData = JSON.parse(payload.toString("utf-8"));

    // Check expiration
    if (new Date(license.expiresAt) < new Date()) {
      return { valid: false, license, error: "expired" };
    }

    return { valid: true, license };
  } catch (err) {
    console.error("License validation error:", err);
    return { valid: false, license: null, error: "malformed" };
  }
}

// Cache validated licenses to avoid repeated crypto operations
const licenseCache = new Map<
  string,
  { result: LicenseValidationResult; cachedAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function validateLicenseCached(
  licenseKey: string
): LicenseValidationResult {
  const cached = licenseCache.get(licenseKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  const result = validateLicense(licenseKey);
  licenseCache.set(licenseKey, { result, cachedAt: Date.now() });
  return result;
}

/**
 * Clear the license validation cache
 * Useful when a license key is updated
 */
export function clearLicenseCache(licenseKey?: string): void {
  if (licenseKey) {
    licenseCache.delete(licenseKey);
  } else {
    licenseCache.clear();
  }
}
