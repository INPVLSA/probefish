import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import { exportProject, ExportFormat } from "@/lib/export";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/export - Export project data
// Supports: Session auth OR Token auth with "exports:read" scope
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request,
    ["exports:read"] // Required scope for token auth
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json") as ExportFormat;
    const includeHistory = searchParams.get("includeHistory") === "true";
    const historyLimit = parseInt(searchParams.get("historyLimit") || "10", 10);

    // Validate format
    if (!["json", "junit", "csv"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Supported: json, junit, csv" },
        { status: 400 }
      );
    }

    const result = await exportProject(projectId, format, {
      includeRunHistory: includeHistory,
      runHistoryLimit: historyLimit,
    });

    // Return file response - handle both string and Buffer types
    let body: BodyInit;
    if (typeof result.data === "string") {
      body = result.data;
    } else {
      body = new Uint8Array(result.data);
    }
    const response = new NextResponse(body);
    response.headers.set("Content-Type", result.contentType);
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`
    );

    return response;
  } catch (error) {
    console.error("Error exporting project:", error);

    if (error instanceof Error && error.message === "Project not found") {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to export project" },
      { status: 500 }
    );
  }
}
