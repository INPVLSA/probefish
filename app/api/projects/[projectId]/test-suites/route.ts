import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/test-suites - List test suites
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

    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "true";

    if (summary) {
      // Return lightweight summary without testCases and lastRun.results
      const testSuites = await TestSuite.aggregate([
        { $match: { projectId: new (await import("mongoose")).Types.ObjectId(projectId) } },
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            targetType: 1,
            targetId: 1,
            testCaseCount: { $size: { $ifNull: ["$testCases", []] } },
            lastRun: {
              $cond: {
                if: { $ifNull: ["$lastRun", false] },
                then: {
                  _id: "$lastRun._id",
                  runAt: "$lastRun.runAt",
                  status: "$lastRun.status",
                  summary: "$lastRun.summary",
                },
                else: null,
              },
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
        { $sort: { updatedAt: -1 } },
      ]);

      return NextResponse.json({ testSuites });
    }

    // Full response (existing behavior)
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

    // Generate unique slug from name
    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug, async (testSlug) => {
      const existing = await TestSuite.findOne({ projectId, slug: testSlug });
      return !!existing;
    });

    const testSuite = new TestSuite({
      name: name.trim(),
      slug,
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
