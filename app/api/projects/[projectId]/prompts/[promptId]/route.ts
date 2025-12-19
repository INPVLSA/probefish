import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import Prompt from "@/lib/db/models/prompt";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string; promptId: string }>;
}

// Helper to extract variables from prompt content
function extractVariables(content: string): string[] {
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

// GET /api/projects/[projectId]/prompts/[promptId] - Get a single prompt
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, promptId } = await params;
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

    const prompt = await Prompt.findOne({ _id: promptId, projectId })
      .populate("createdBy", "name email")
      .populate("versions.createdBy", "name email");

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error fetching prompt:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/prompts/[promptId] - Update prompt metadata
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, promptId } = await params;
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

    const prompt = await Prompt.findOne({ _id: promptId, projectId });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, tags } = body;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Prompt name cannot be empty" },
          { status: 400 }
        );
      }
      prompt.name = name.trim();
    }

    if (description !== undefined) {
      prompt.description = description?.trim() || undefined;
    }

    if (tags !== undefined) {
      prompt.tags = tags;
    }

    await prompt.save();

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error updating prompt:", error);
    return NextResponse.json(
      { error: "Failed to update prompt" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[projectId]/prompts/[promptId] - Create new version
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, promptId } = await params;
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

    const prompt = await Prompt.findOne({ _id: promptId, projectId });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const body = await request.json();
    const { content, systemPrompt, modelConfig, note } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt content is required" },
        { status: 400 }
      );
    }

    const variables = extractVariables(content);
    const newVersion = prompt.currentVersion + 1;

    prompt.versions.push({
      version: newVersion,
      content,
      systemPrompt,
      variables,
      modelConfig: modelConfig || {},
      createdBy: new mongoose.Types.ObjectId(session.userId),
      createdAt: new Date(),
      note,
    });

    prompt.currentVersion = newVersion;
    await prompt.save();

    // Populate createdBy for the response
    await prompt.populate("versions.createdBy", "name email");

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error creating prompt version:", error);
    return NextResponse.json(
      { error: "Failed to create prompt version" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]/prompts/[promptId] - Delete a prompt
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, promptId } = await params;
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

    const prompt = await Prompt.findOneAndDelete({ _id: promptId, projectId });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
