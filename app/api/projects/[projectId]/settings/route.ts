import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import { connectDB } from "@/lib/db/mongodb";
import Project, { ProjectVisibility } from "@/lib/db/models/project";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/settings - Get project settings
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const project = await Project.findById(projectId)
      .select("name description visibility inheritFromParent parentId")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: {
        name: project.name,
        description: project.description,
        visibility: project.visibility || "public",
        inheritFromParent: project.inheritFromParent ?? true,
        parentId: project.parentId?.toString() || null,
      },
      userRole: auth.context.project?.effectiveRole,
      canManage:
        auth.context.project?.effectiveRole === "full" ||
        auth.context.project?.effectiveRole === "admin",
    });
  } catch (error) {
    console.error("Error fetching project settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch project settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/settings - Update project settings
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.MANAGE,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    const body = await request.json();
    const { visibility, inheritFromParent, name, description } = body;

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update fields if provided
    if (visibility !== undefined) {
      if (!["public", "private"].includes(visibility)) {
        return NextResponse.json(
          { error: "Invalid visibility value" },
          { status: 400 }
        );
      }
      project.visibility = visibility as ProjectVisibility;
    }

    if (inheritFromParent !== undefined) {
      project.inheritFromParent = Boolean(inheritFromParent);
    }

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description?.trim() || undefined;
    }

    await project.save();

    return NextResponse.json({
      success: true,
      settings: {
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        inheritFromParent: project.inheritFromParent,
        parentId: project.parentId?.toString() || null,
      },
    });
  } catch (error) {
    console.error("Error updating project settings:", error);
    return NextResponse.json(
      { error: "Failed to update project settings" },
      { status: 500 }
    );
  }
}
