import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Organization, User } from "@/lib/db/models";
import {
  requireOrgPermission,
  authError,
} from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// GET /api/organizations/[orgId]/members - List members
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.READ,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();
    const org = await Organization.findById(orgId).populate(
      "members.userId",
      "name email avatar"
    );

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const members = org.members.map((m) => {
      const user = m.userId as unknown as {
        _id: string;
        name: string;
        email: string;
        avatar?: string;
      };
      return {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[orgId]/members - Add member by email
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!role || !["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role is required (admin, member, viewer)" },
        { status: 400 }
      );
    }

    await connectDB();

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = org.members.find(
      (m) => m.userId.toString() === user._id.toString()
    );

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 }
      );
    }

    // Add member to organization
    org.members.push({
      userId: user._id,
      role,
      joinedAt: new Date(),
    });
    await org.save();

    // Add organization to user's organizationIds
    if (!user.organizationIds.some((id) => id.toString() === orgId)) {
      user.organizationIds.push(org._id);
      await user.save();
    }

    return NextResponse.json(
      {
        message: "Member added successfully",
        member: {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          role,
          joinedAt: new Date(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
