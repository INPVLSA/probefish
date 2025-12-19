import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import Endpoint from "@/lib/db/models/endpoint";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string; endpointId: string }>;
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

// GET /api/projects/[projectId]/endpoints/[endpointId] - Get a single endpoint
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, endpointId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!user.organizationIds.some(id => id.toString() === project.organizationId.toString())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const endpoint = await Endpoint.findOne({ _id: endpointId, projectId })
      .populate("createdBy", "name email");

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    return NextResponse.json({ endpoint });
  } catch (error) {
    console.error("Error fetching endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch endpoint" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/endpoints/[endpointId] - Update endpoint
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, endpointId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!user.organizationIds.some(id => id.toString() === project.organizationId.toString())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const endpoint = await Endpoint.findOne({ _id: endpointId, projectId });
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, config } = body;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Endpoint name cannot be empty" },
          { status: 400 }
        );
      }
      endpoint.name = name.trim();
    }

    if (description !== undefined) {
      endpoint.description = description?.trim() || undefined;
    }

    if (config !== undefined) {
      if (!config.url || config.url.trim().length === 0) {
        return NextResponse.json(
          { error: "Endpoint URL is required" },
          { status: 400 }
        );
      }

      endpoint.config = {
        method: config.method || endpoint.config.method || "POST",
        url: config.url.trim(),
        headers: config.headers || {},
        auth: config.auth || { type: "none" },
        bodyTemplate: config.bodyTemplate || "",
        contentType: config.contentType || "application/json",
        responseContentPath: config.responseContentPath || "",
      };

      endpoint.variables = extractVariables(config.bodyTemplate || "");
    }

    await endpoint.save();

    return NextResponse.json({ endpoint });
  } catch (error) {
    console.error("Error updating endpoint:", error);
    return NextResponse.json(
      { error: "Failed to update endpoint" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]/endpoints/[endpointId] - Delete an endpoint
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, endpointId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!user.organizationIds.some(id => id.toString() === project.organizationId.toString())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const endpoint = await Endpoint.findOneAndDelete({ _id: endpointId, projectId });
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Endpoint deleted successfully" });
  } catch (error) {
    console.error("Error deleting endpoint:", error);
    return NextResponse.json(
      { error: "Failed to delete endpoint" },
      { status: 500 }
    );
  }
}
