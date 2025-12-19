import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import Organization from "@/lib/db/models/organization";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// GET /api/organizations/[orgId] - Get organization details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    await connectDB();

    const authResult = await requireOrgPermission(orgId, PERMISSIONS.READ, request);
    if (!authResult.authorized) {
      return authError(authResult);
    }

    const org = await Organization.findById(orgId)
      .select("-llmCredentials")
      .populate("members.userId", "name email");

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        members: org.members.map((m) => ({
          userId: (m.userId as unknown as { _id: string; name: string; email: string })._id?.toString() || m.userId.toString(),
          name: (m.userId as unknown as { name: string })?.name || "Unknown",
          email: (m.userId as unknown as { email: string })?.email || "",
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        settings: org.settings,
        createdAt: org.createdAt,
        userRole: authResult.context?.organization?.role,
      },
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[orgId] - Update organization details
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    await connectDB();

    // Require admin permission to update org
    const authResult = await requireOrgPermission(orgId, PERMISSIONS.MANAGE_MEMBERS, request);
    if (!authResult.authorized) {
      return authError(authResult);
    }

    const body = await request.json();
    const { name, slug, settings } = body;

    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Update name
    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Organization name must be at least 2 characters" },
          { status: 400 }
        );
      }
      org.name = name.trim();
    }

    // Update slug
    if (slug !== undefined) {
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slug || !slugRegex.test(slug)) {
        return NextResponse.json(
          { error: "Slug can only contain lowercase letters, numbers, and hyphens" },
          { status: 400 }
        );
      }

      // Check if slug is already taken
      const existingOrg = await Organization.findOne({ slug, _id: { $ne: orgId } });
      if (existingOrg) {
        return NextResponse.json(
          { error: "This slug is already taken" },
          { status: 400 }
        );
      }

      org.slug = slug;
    }

    // Update settings
    if (settings !== undefined) {
      if (settings.defaultJudgeModel !== undefined) {
        org.settings.defaultJudgeModel = settings.defaultJudgeModel;
      }
      if (settings.maxConcurrentTests !== undefined) {
        const maxTests = parseInt(settings.maxConcurrentTests, 10);
        if (isNaN(maxTests) || maxTests < 1 || maxTests > 50) {
          return NextResponse.json(
            { error: "Max concurrent tests must be between 1 and 50" },
            { status: 400 }
          );
        }
        org.settings.maxConcurrentTests = maxTests;
      }
    }

    await org.save();

    return NextResponse.json({
      organization: {
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        settings: org.settings,
      },
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
