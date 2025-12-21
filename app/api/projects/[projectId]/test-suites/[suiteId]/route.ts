import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";

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

    const project = await Project.findById(projectId);
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

    const testSuite = await TestSuite.findOne({
      _id: suiteId,
      projectId,
    });

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ testSuite });
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

    const project = await Project.findById(projectId);
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

    const testSuite = await TestSuite.findOne({
      _id: suiteId,
      projectId,
    });

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
          };
          testSuite.markModified("llmJudgeConfig");
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

    const project = await Project.findById(projectId);
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

    const testSuite = await TestSuite.findOneAndDelete({
      _id: suiteId,
      projectId,
    });

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test suite:", error);
    return NextResponse.json(
      { error: "Failed to delete test suite" },
      { status: 500 }
    );
  }
}
