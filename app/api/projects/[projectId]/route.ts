import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId] - Get a single project
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

    // Use resolved project ID from auth context (handles both ObjectId and slug)
    const resolvedProjectId = auth.context.project?.id;
    const project = await Project.findById(resolvedProjectId).populate(
      "createdBy",
      "name email"
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project,
      userRole: auth.context.project?.effectiveRole,
      accessSource: auth.context.project?.accessSource,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.EDIT,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    // Use resolved project ID from auth context (handles both ObjectId and slug)
    const resolvedProjectId = auth.context.project?.id;
    const project = await Project.findById(resolvedProjectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, parentId, color, icon } = body;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Project name cannot be empty" },
          { status: 400 }
        );
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description?.trim() || undefined;
    }

    if (parentId !== undefined) {
      if (parentId === resolvedProjectId) {
        return NextResponse.json(
          { error: "Project cannot be its own parent" },
          { status: 400 }
        );
      }
      if (parentId) {
        const parent = await Project.findById(parentId);
        if (
          !parent ||
          parent.organizationId.toString() !== project.organizationId.toString()
        ) {
          return NextResponse.json(
            { error: "Parent project not found" },
            { status: 404 }
          );
        }
        if (!parent.isFolder) {
          return NextResponse.json(
            { error: "Parent must be a folder" },
            { status: 400 }
          );
        }
      }
      project.parentId = parentId || null;
    }

    if (color !== undefined) project.color = color;
    if (icon !== undefined) project.icon = icon;

    await project.save();

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId] - Delete a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    await connectDB();

    // Use resolved project ID from auth context (handles both ObjectId and slug)
    const resolvedProjectId = auth.context.project?.id;
    const project = await Project.findById(resolvedProjectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if folder has children
    if (project.isFolder) {
      const childCount = await Project.countDocuments({ parentId: resolvedProjectId });
      if (childCount > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete folder with children. Delete or move children first.",
          },
          { status: 400 }
        );
      }
    }

    await Project.findByIdAndDelete(resolvedProjectId);

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
