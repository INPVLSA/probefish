import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import User from "@/lib/db/models/user";

// GET /api/projects - List all projects for user's organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const organizationId = user.organizationIds[0]; // Use first org for now

    const query: Record<string, unknown> = { organizationId };
    if (parentId) {
      query.parentId = parentId;
    } else {
      query.parentId = null; // Root level projects
    }

    const projects = await Project.find(query)
      .sort({ isFolder: -1, name: 1 })
      .populate("createdBy", "name email");

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, parentId, isFolder, color, icon } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const organizationId = user.organizationIds[0];

    // If parentId provided, verify it exists and belongs to same org
    if (parentId) {
      const parent = await Project.findById(parentId);
      if (!parent || parent.organizationId.toString() !== organizationId.toString()) {
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

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim(),
      organizationId,
      parentId: parentId || null,
      isFolder: isFolder || false,
      color,
      icon,
      createdBy: session.userId,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
