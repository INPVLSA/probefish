import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import TestSuite from "@/lib/db/models/testSuite";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string; runId: string }>;
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/runs/[runId] - Get single run with full results
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId, suiteId, runId } = await params;

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

    const testSuite = await TestSuite.findOne({
      _id: suiteId,
      projectId,
    }).select("runHistory");

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    const run = testSuite.runHistory.find((r) => r._id.toString() === runId);

    if (!run) {
      return NextResponse.json(
        { error: "Test run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error("Error fetching run:", error);
    return NextResponse.json(
      { error: "Failed to fetch run" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/test-suites/[suiteId]/runs/[runId] - Update run (e.g., note)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId, suiteId, runId } = await params;

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

    const body = await request.json();

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

    // Find the run in runHistory
    const runIndex = testSuite.runHistory.findIndex(
      (r) => r._id.toString() === runId
    );

    if (runIndex === -1) {
      return NextResponse.json(
        { error: "Test run not found" },
        { status: 404 }
      );
    }

    // Update allowed fields
    if (typeof body.note === "string") {
      testSuite.runHistory[runIndex].note = body.note.trim().slice(0, 500) || undefined;
    }

    testSuite.markModified("runHistory");
    await testSuite.save();

    return NextResponse.json({
      success: true,
      run: testSuite.runHistory[runIndex],
    });
  } catch (error) {
    console.error("Error updating run:", error);
    return NextResponse.json(
      { error: "Failed to update run" },
      { status: 500 }
    );
  }
}
