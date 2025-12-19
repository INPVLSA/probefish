import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import Prompt from "@/lib/db/models/prompt";

interface RouteParams {
  params: Promise<{ projectId: string }>;
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

// GET /api/projects/[projectId]/prompts - List prompts in a project
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

    const prompts = await Prompt.find({ projectId })
      .select("-versions.content -versions.systemPrompt") // Exclude large content in list
      .sort({ updatedAt: -1 })
      .populate("createdBy", "name email");

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/prompts - Create a new prompt
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.isFolder) {
      return NextResponse.json(
        { error: "Cannot create prompts in a folder. Use a project instead." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, content, systemPrompt, modelConfig, tags, note } =
      body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt name is required" },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt content is required" },
        { status: 400 }
      );
    }

    const variables = extractVariables(content);

    const prompt = await Prompt.create({
      name: name.trim(),
      description: description?.trim(),
      projectId,
      organizationId: project.organizationId,
      versions: [
        {
          version: 1,
          content: content,
          systemPrompt: systemPrompt,
          variables,
          modelConfig: modelConfig || {},
          createdBy: new mongoose.Types.ObjectId(auth.context.user.id),
          createdAt: new Date(),
          note: note,
        },
      ],
      currentVersion: 1,
      tags: tags || [],
      createdBy: new mongoose.Types.ObjectId(auth.context.user.id),
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}
