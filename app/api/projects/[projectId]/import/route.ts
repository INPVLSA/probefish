import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import { previewProjectImport, importProject, ImportOptions } from "@/lib/import";
import Project from "@/lib/db/models/project";
import { connectDB } from "@/lib/db/mongodb";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// PUT /api/projects/[projectId]/import - Preview import (validate only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdentifier } = await params;

  const auth = await requireProjectPermission(
    projectIdentifier,
    PROJECT_PERMISSIONS.EDIT,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  // Use the resolved project ID from auth context
  const projectId = auth.context.project!.id;

  try {
    const contentType = request.headers.get("content-type") || "";

    let data: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 50MB" },
          { status: 400 }
        );
      }

      const text = await file.text();
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON file" },
          { status: 400 }
        );
      }
    } else if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data or application/json" },
        { status: 400 }
      );
    }

    const preview = await previewProjectImport(projectId, data);

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("Error previewing import:", error);
    return NextResponse.json(
      { error: "Failed to preview import" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/import - Execute import
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdentifier } = await params;

  const auth = await requireProjectPermission(
    projectIdentifier,
    PROJECT_PERMISSIONS.EDIT,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  // Use the resolved project ID from auth context
  const projectId = auth.context.project!.id;

  try {
    await connectDB();

    // Get project to get organizationId
    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let data: unknown;
    let options: ImportOptions = { mode: "merge", skipExisting: true };

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const modeParam = formData.get("mode") as string | null;
      const skipExistingParam = formData.get("skipExisting") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 50MB" },
          { status: 400 }
        );
      }

      const text = await file.text();
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON file" },
          { status: 400 }
        );
      }

      if (modeParam === "merge" || modeParam === "replace") {
        options.mode = modeParam;
      }
      if (skipExistingParam !== null) {
        options.skipExisting = skipExistingParam === "true";
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      data = body.data;
      if (body.options) {
        options = { ...options, ...body.options };
      }
    } else {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data or application/json" },
        { status: 400 }
      );
    }

    const result = await importProject(
      projectId,
      project.organizationId.toString(),
      auth.context.user.id,
      data,
      options
    );

    return NextResponse.json({
      result: {
        success: result.success,
        counts: result.counts,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("Error executing import:", error);
    return NextResponse.json(
      { error: "Failed to execute import" },
      { status: 500 }
    );
  }
}
