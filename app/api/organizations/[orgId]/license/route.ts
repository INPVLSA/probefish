import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import Organization from "@/lib/db/models/organization";
import {
  validateLicense,
  clearLicenseCache,
  getLicenseStatus,
  isCloudMode,
} from "@/lib/license";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// GET /api/organizations/[orgId]/license - Get current license status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    await connectDB();

    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.READ,
      request
    );
    if (!authResult.authorized) {
      return authError(authResult);
    }

    const org = await Organization.findById(orgId).select(
      "licenseKey subscription usage"
    );

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const status = getLicenseStatus({
      licenseKey: org.licenseKey,
      subscription: org.subscription,
      usage: org.usage,
    });

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching license status:", error);
    return NextResponse.json(
      { error: "Failed to fetch license status" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[orgId]/license - Set license key
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    await connectDB();

    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_KEYS,
      request
    );
    if (!authResult.authorized) {
      return authError(authResult);
    }

    const body = await request.json();
    const { licenseKey } = body;

    if (!licenseKey || typeof licenseKey !== "string") {
      return NextResponse.json(
        { error: "License key is required" },
        { status: 400 }
      );
    }

    // Validate before saving
    const result = validateLicense(licenseKey.trim());
    if (!result.valid) {
      const errorMessages: Record<string, string> = {
        invalid_signature: "Invalid license key signature",
        expired: "License key has expired",
        malformed: "License key is malformed",
        not_found: "License key is required",
      };
      return NextResponse.json(
        { error: errorMessages[result.error || "malformed"] },
        { status: 400 }
      );
    }

    // Check if license is bound to a specific organization
    if (
      result.license?.organizationId &&
      result.license.organizationId !== orgId
    ) {
      return NextResponse.json(
        { error: "This license key is bound to a different organization" },
        { status: 400 }
      );
    }

    // Clear cache for any existing license key before updating
    const org = await Organization.findById(orgId).select("licenseKey");
    if (org?.licenseKey) {
      clearLicenseCache(org.licenseKey);
    }

    // Update organization with new license key
    await Organization.findByIdAndUpdate(orgId, {
      licenseKey: licenseKey.trim(),
    });

    return NextResponse.json({
      success: true,
      plan: result.license!.plan,
      expiresAt: result.license!.expiresAt,
      organizationName: result.license!.organizationName,
      deploymentMode: isCloudMode() ? "cloud" : "self-hosted",
    });
  } catch (error) {
    console.error("Error setting license key:", error);
    return NextResponse.json(
      { error: "Failed to set license key" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[orgId]/license - Remove license key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    await connectDB();

    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_KEYS,
      request
    );
    if (!authResult.authorized) {
      return authError(authResult);
    }

    // Clear cache for existing license key
    const org = await Organization.findById(orgId).select("licenseKey");
    if (org?.licenseKey) {
      clearLicenseCache(org.licenseKey);
    }

    // Remove license key
    await Organization.findByIdAndUpdate(orgId, {
      $unset: { licenseKey: 1 },
    });

    return NextResponse.json({
      success: true,
      plan: "free",
    });
  } catch (error) {
    console.error("Error removing license key:", error);
    return NextResponse.json(
      { error: "Failed to remove license key" },
      { status: 500 }
    );
  }
}
