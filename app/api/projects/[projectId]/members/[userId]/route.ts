import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS, canManageProjectRole } from "@/lib/auth/projectPermissions";
import { connectDB } from "@/lib/db/mongodb";
import Project, { ProjectRole } from "@/lib/db/models/project";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string; userId: string }>;
}

// PATCH /api/projects/[projectId]/members/[userId] - Update member role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId, userId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.MANAGE_MEMBERS,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !["viewer", "editor", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role is required (viewer, editor, admin)" },
        { status: 400 }
      );
    }

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find the member
    const memberIndex = project.members.findIndex(
      (m) => m.userId.toString() === userId
    );

    if (memberIndex === -1) {
      return NextResponse.json(
        { error: "User is not a project member" },
        { status: 404 }
      );
    }

    const currentRole = project.members[memberIndex].role;

    // Check if user can manage this role
    const effectiveRole = auth.context.project?.effectiveRole || "viewer";
    if (!canManageProjectRole(effectiveRole, currentRole)) {
      return NextResponse.json(
        { error: "You cannot manage this member's role" },
        { status: 403 }
      );
    }

    // Check if user can assign the new role
    if (!canManageProjectRole(effectiveRole, role as ProjectRole)) {
      return NextResponse.json(
        { error: "You cannot assign this role" },
        { status: 403 }
      );
    }

    // Update role
    project.members[memberIndex].role = role as ProjectRole;
    await project.save();

    const user = await User.findById(userId).select("name email");

    return NextResponse.json({
      success: true,
      member: {
        userId,
        name: user?.name || "Unknown User",
        email: user?.email || "",
        role,
      },
    });
  } catch (error) {
    console.error("Error updating project member:", error);
    return NextResponse.json(
      { error: "Failed to update project member" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]/members/[userId] - Remove member from project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { projectId, userId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.MANAGE_MEMBERS,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find the member
    const memberIndex = project.members.findIndex(
      (m) => m.userId.toString() === userId
    );

    if (memberIndex === -1) {
      return NextResponse.json(
        { error: "User is not a project member" },
        { status: 404 }
      );
    }

    const currentRole = project.members[memberIndex].role;

    // Check if user can manage this role
    const effectiveRole = auth.context.project?.effectiveRole || "viewer";
    if (!canManageProjectRole(effectiveRole, currentRole)) {
      return NextResponse.json(
        { error: "You cannot remove this member" },
        { status: 403 }
      );
    }

    // Remove member
    project.members.splice(memberIndex, 1);
    await project.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing project member:", error);
    return NextResponse.json(
      { error: "Failed to remove project member" },
      { status: 500 }
    );
  }
}
