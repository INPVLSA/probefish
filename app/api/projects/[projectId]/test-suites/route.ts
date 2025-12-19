import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/test-suites - List test suites
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

    const testSuites = await TestSuite.find({ projectId })
      .select("-runHistory")
      .sort({ updatedAt: -1 });

    return NextResponse.json({ testSuites });
  } catch (error) {
    console.error("Error fetching test suites:", error);
    return NextResponse.json(
      { error: "Failed to fetch test suites" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/test-suites - Create test suite
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
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      targetType,
      targetId,
      targetVersion,
      testCases = [],
      validationRules = [],
      llmJudgeConfig = { enabled: false, criteria: [] },
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Test suite name is required" },
        { status: 400 }
      );
    }

    if (!targetType || !["prompt", "endpoint"].includes(targetType)) {
      return NextResponse.json(
        { error: "Target type must be 'prompt' or 'endpoint'" },
        { status: 400 }
      );
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "Target ID is required" },
        { status: 400 }
      );
    }

    const testSuite = new TestSuite({
      name: name.trim(),
      description: description?.trim(),
      projectId,
      organizationId: project.organizationId,
      targetType,
      targetId,
      targetVersion,
      testCases,
      validationRules,
      llmJudgeConfig,
      createdBy: auth.context.user.id,
    });

    await testSuite.save();

    return NextResponse.json({ testSuite }, { status: 201 });
  } catch (error) {
    console.error("Error creating test suite:", error);
    return NextResponse.json(
      { error: "Failed to create test suite" },
      { status: 500 }
    );
  }
}
