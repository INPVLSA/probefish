import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import { authenticateToken, hasScope } from "@/lib/auth/tokenAuth";
import TestSuite from "@/lib/db/models/testSuite";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string; testCaseId: string }>;
}

// Helper to authenticate and get organization context
async function authenticate(request: NextRequest, requiredScope: "test-suites:read" | "test-suites:write") {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const tokenResult = await authenticateToken(request);
    if (!tokenResult.success || !tokenResult.token) {
      return { error: tokenResult.error || "Invalid token", status: 401 };
    }

    if (!hasScope(tokenResult.token, requiredScope)) {
      return { error: `Missing required scope: ${requiredScope}`, status: 403 };
    }

    return { organizationId: tokenResult.organizationId };
  } else {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized", status: 401 };
    }
    return { userId: session.userId };
  }
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/test-cases/[testCaseId] - Get single test case
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId, testCaseId } = await params;

    const auth = await authenticate(request, "test-suites:read");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();

    const query: Record<string, unknown> = {
      _id: suiteId,
      projectId,
    };
    if (auth.organizationId) {
      query.organizationId = auth.organizationId;
    }

    const testSuite = await TestSuite.findOne(query);

    if (!testSuite) {
      return NextResponse.json({ error: "Test suite not found" }, { status: 404 });
    }

    const testCase = testSuite.testCases.find(
      (tc: { _id: { toString: () => string } }) => tc._id.toString() === testCaseId
    );

    if (!testCase) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    return NextResponse.json({ testCase });
  } catch (error) {
    console.error("Error fetching test case:", error);
    return NextResponse.json({ error: "Failed to fetch test case" }, { status: 500 });
  }
}

// PATCH /api/projects/[projectId]/test-suites/[suiteId]/test-cases/[testCaseId] - Update test case
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId, testCaseId } = await params;

    const auth = await authenticate(request, "test-suites:write");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();

    const query: Record<string, unknown> = {
      _id: suiteId,
      projectId,
    };
    if (auth.organizationId) {
      query.organizationId = auth.organizationId;
    }

    const testSuite = await TestSuite.findOne(query);

    if (!testSuite) {
      return NextResponse.json({ error: "Test suite not found" }, { status: 404 });
    }

    const testCaseIndex = testSuite.testCases.findIndex(
      (tc: { _id: { toString: () => string } }) => tc._id.toString() === testCaseId
    );

    if (testCaseIndex === -1) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedUpdates = ["name", "inputs", "expectedOutput", "notes", "tags", "enabled"];

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        if (key === "name") {
          if (!body.name?.trim()) {
            return NextResponse.json({ error: "Test case name is required" }, { status: 400 });
          }
          testSuite.testCases[testCaseIndex].name = body.name.trim();
        } else if (key === "inputs") {
          if (typeof body.inputs !== "object" || body.inputs === null) {
            return NextResponse.json({ error: "Inputs must be an object" }, { status: 400 });
          }
          testSuite.testCases[testCaseIndex].inputs = body.inputs;
        } else if (key === "expectedOutput") {
          testSuite.testCases[testCaseIndex].expectedOutput = body.expectedOutput?.trim() || "";
        } else if (key === "notes") {
          testSuite.testCases[testCaseIndex].notes = body.notes?.trim() || "";
        } else if (key === "tags") {
          if (!Array.isArray(body.tags)) {
            return NextResponse.json({ error: "Tags must be an array" }, { status: 400 });
          }
          testSuite.testCases[testCaseIndex].tags = body.tags;
        } else if (key === "enabled") {
          testSuite.testCases[testCaseIndex].enabled = Boolean(body.enabled);
        }
      }
    }

    testSuite.markModified("testCases");
    await testSuite.save();

    return NextResponse.json({
      success: true,
      testCase: testSuite.testCases[testCaseIndex],
    });
  } catch (error) {
    console.error("Error updating test case:", error);
    return NextResponse.json({ error: "Failed to update test case" }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/test-suites/[suiteId]/test-cases/[testCaseId] - Delete test case
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId, testCaseId } = await params;

    const auth = await authenticate(request, "test-suites:write");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();

    const query: Record<string, unknown> = {
      _id: suiteId,
      projectId,
    };
    if (auth.organizationId) {
      query.organizationId = auth.organizationId;
    }

    const testSuite = await TestSuite.findOne(query);

    if (!testSuite) {
      return NextResponse.json({ error: "Test suite not found" }, { status: 404 });
    }

    const testCaseIndex = testSuite.testCases.findIndex(
      (tc: { _id: { toString: () => string } }) => tc._id.toString() === testCaseId
    );

    if (testCaseIndex === -1) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    const deletedTestCase = testSuite.testCases[testCaseIndex];
    testSuite.testCases.splice(testCaseIndex, 1);
    testSuite.markModified("testCases");
    await testSuite.save();

    return NextResponse.json({
      success: true,
      deleted: {
        _id: deletedTestCase._id,
        name: deletedTestCase.name,
      },
    });
  } catch (error) {
    console.error("Error deleting test case:", error);
    return NextResponse.json({ error: "Failed to delete test case" }, { status: 500 });
  }
}
