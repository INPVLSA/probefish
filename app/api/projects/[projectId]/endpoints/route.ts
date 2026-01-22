import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import Endpoint from "@/lib/db/models/endpoint";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// Helper to extract variables from body template
function extractVariables(content: string): string[] {
  if (!content) return [];
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  return variables;
}

// GET /api/projects/[projectId]/endpoints - List endpoints in a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdentifier } = await params;

  const auth = await requireProjectPermission(
    projectIdentifier,
    PROJECT_PERMISSIONS.VIEW,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  // Use the resolved project ID from auth context
  const projectId = auth.context.project!.id;

  try {
    await connectDB();

    const endpoints = await Endpoint.find({ projectId })
      .sort({ updatedAt: -1 })
      .populate("createdBy", "name email");

    return NextResponse.json({ endpoints });
  } catch (error) {
    console.error("Error fetching endpoints:", error);
    return NextResponse.json(
      { error: "Failed to fetch endpoints" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/endpoints - Create a new endpoint
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

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.isFolder) {
      return NextResponse.json(
        { error: "Cannot create endpoints in a folder. Use a project instead." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, config } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Endpoint name is required" },
        { status: 400 }
      );
    }

    if (!config || !config.url || config.url.trim().length === 0) {
      return NextResponse.json(
        { error: "Endpoint URL is required" },
        { status: 400 }
      );
    }

    const variables = extractVariables(config.bodyTemplate || "");

    // Generate unique slug from name
    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug, async (testSlug) => {
      const existing = await Endpoint.findOne({ projectId, slug: testSlug });
      return !!existing;
    });

    const endpoint = await Endpoint.create({
      name: name.trim(),
      slug,
      description: description?.trim(),
      projectId,
      organizationId: project.organizationId,
      config: {
        method: config.method || "POST",
        url: config.url.trim(),
        headers: config.headers || {},
        auth: config.auth || { type: "none" },
        bodyTemplate: config.bodyTemplate || "",
        contentType: config.contentType || "application/json",
        responseContentPath: config.responseContentPath || "",
      },
      variables,
      createdBy: auth.context.user.id,
    });

    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (error) {
    console.error("Error creating endpoint:", error);
    return NextResponse.json(
      { error: "Failed to create endpoint" },
      { status: 500 }
    );
  }
}
