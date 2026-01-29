import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";
import {
  resolveProjectAcrossOrgs,
  resolveTestSuiteByIdentifier,
} from "@/lib/utils/resolve-identifier";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// GET /api/projects/[projectId]/test-suites/[suiteId] - Get test suite
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, suiteId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 }
      );
    }

    // Resolve project by ID or slug
    const project = await resolveProjectAcrossOrgs(projectId, user.organizationIds);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (
      !user.organizationIds.some(
        (id) => id.toString() === project.organizationId.toString()
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "true";

    // Resolve test suite by ID or slug
    const testSuite = await resolveTestSuiteByIdentifier(
      suiteId,
      project._id.toString()
    );

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    // Re-fetch with select to exclude comparisonSessions
    const fullSuite = await TestSuite.findById(testSuite._id).select("-comparisonSessions");
    if (!fullSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    // When summary=true, strip results from lastRun to reduce payload
    if (summary && fullSuite.lastRun) {
      const suiteObj = fullSuite.toObject();
      suiteObj.lastRun = {
        _id: fullSuite.lastRun._id,
        runAt: fullSuite.lastRun.runAt,
        status: fullSuite.lastRun.status,
        summary: fullSuite.lastRun.summary,
      } as typeof suiteObj.lastRun;
      return NextResponse.json({ testSuite: suiteObj });
    }

    return NextResponse.json({ testSuite: fullSuite });
  } catch (error) {
    console.error("Error fetching test suite:", error);
    return NextResponse.json(
      { error: "Failed to fetch test suite" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/test-suites/[suiteId] - Update test suite
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, suiteId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 }
      );
    }

    // Resolve project by ID or slug
    const project = await resolveProjectAcrossOrgs(projectId, user.organizationIds);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (
      !user.organizationIds.some(
        (id) => id.toString() === project.organizationId.toString()
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Resolve test suite by ID or slug
    const testSuite = await resolveTestSuiteByIdentifier(
      suiteId,
      project._id.toString()
    );

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const allowedUpdates = [
      "name",
      "description",
      "targetVersion",
      "testCases",
      "validationRules",
      "llmJudgeConfig",
      "comparisonModels",
      "parallelExecution",
    ];

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        if (key === "name") {
          if (!body.name?.trim()) {
            return NextResponse.json(
              { error: "Test suite name is required" },
              { status: 400 }
            );
          }
          testSuite.name = body.name.trim();
        } else if (key === "description") {
          testSuite.description = body.description?.trim();
        } else if (key === "llmJudgeConfig") {
          // Handle llmJudgeConfig specially to ensure nested fields are saved
          // Create a complete new object to ensure Mongoose detects the change
          testSuite.llmJudgeConfig = {
            enabled: body.llmJudgeConfig.enabled ?? false,
            provider: body.llmJudgeConfig.provider,
            model: body.llmJudgeConfig.model,
            criteria: body.llmJudgeConfig.criteria || [],
            validationRules: body.llmJudgeConfig.validationRules || [],
            minScore: body.llmJudgeConfig.minScore,
          };
          testSuite.markModified("llmJudgeConfig");
        } else if (key === "comparisonModels") {
          // Handle comparisonModels specially to ensure nested array is saved
          testSuite.comparisonModels = (body.comparisonModels || []).map(
            (m: { provider: string; model: string; isPrimary?: boolean }) => ({
              provider: m.provider,
              model: m.model,
              isPrimary: m.isPrimary ?? false,
            })
          );
          testSuite.markModified("comparisonModels");
        } else {
          (testSuite as unknown as Record<string, unknown>)[key] = body[key];
        }
      }
    }

    await testSuite.save();

    return NextResponse.json({ testSuite });
  } catch (error) {
    console.error("Error updating test suite:", error);
    return NextResponse.json(
      { error: "Failed to update test suite" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]/test-suites/[suiteId] - Delete test suite
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, suiteId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 }
      );
    }

    // Resolve project by ID or slug
    const project = await resolveProjectAcrossOrgs(projectId, user.organizationIds);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (
      !user.organizationIds.some(
        (id) => id.toString() === project.organizationId.toString()
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Resolve test suite by ID or slug, then delete
    const testSuite = await resolveTestSuiteByIdentifier(
      suiteId,
      project._id.toString()
    );

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    await TestSuite.findByIdAndDelete(testSuite._id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test suite:", error);
    return NextResponse.json(
      { error: "Failed to delete test suite" },
      { status: 500 }
    );
  }
}
