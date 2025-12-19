import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Organization, User } from "@/lib/db/models";
import {
  requireOrgPermission,
  authError,
} from "@/lib/auth/authorization";
import { PERMISSIONS, canManageRole } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ orgId: string; userId: string }>;
}

// PATCH /api/organizations/[orgId]/members/[userId] - Update member role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, userId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role is required (admin, member, viewer)" },
        { status: 400 }
      );
    }

    await connectDB();

    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const memberIndex = org.members.findIndex(
      (m) => m.userId.toString() === userId
    );

    if (memberIndex === -1) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetMember = org.members[memberIndex];

    // Prevent changing owner's role
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change the owner's role" },
        { status: 403 }
      );
    }

    // Check if current user can manage the target role
    const currentRole = authResult.context.organization?.role;
    if (
      currentRole !== "super_admin" &&
      !canManageRole(currentRole || "", targetMember.role)
    ) {
      return NextResponse.json(
        { error: "You cannot manage users with this role" },
        { status: 403 }
      );
    }

    // Prevent non-owners from promoting to admin (unless super admin)
    if (
      role === "admin" &&
      currentRole !== "owner" &&
      currentRole !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "Only owners can promote members to admin" },
        { status: 403 }
      );
    }

    // Update role
    org.members[memberIndex].role = role;
    await org.save();

    return NextResponse.json({
      message: "Role updated successfully",
      member: { userId, role },
    });
  } catch (error) {
    console.error("Update member role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[orgId]/members/[userId] - Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, userId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    await connectDB();

    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const member = org.members.find((m) => m.userId.toString() === userId);

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing owner
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    // Check if current user can manage the target role
    const currentRole = authResult.context.organization?.role;
    if (
      currentRole !== "super_admin" &&
      !canManageRole(currentRole || "", member.role)
    ) {
      return NextResponse.json(
        { error: "You cannot remove users with this role" },
        { status: 403 }
      );
    }

    // Remove from organization
    org.members = org.members.filter((m) => m.userId.toString() !== userId);
    await org.save();

    // Remove organization from user's organizationIds
    const user = await User.findById(userId);
    if (user) {
      user.organizationIds = user.organizationIds.filter(
        (id) => id.toString() !== orgId
      );
      await user.save();
    }

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
