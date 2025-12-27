import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import { authenticateToken, hasScope } from "@/lib/auth/tokenAuth";
import TestSuite from "@/lib/db/models/testSuite";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// POST /api/projects/[projectId]/test-suites/[suiteId]/test-cases - Add test case(s)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId } = await params;

    let organizationId: string | undefined;

    // Check auth header to determine auth method
    const authHeader = request.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      // Token auth
      const tokenResult = await authenticateToken(request);
      if (!tokenResult.success || !tokenResult.token) {
        return NextResponse.json(
          { error: tokenResult.error || "Invalid token" },
          { status: 401 }
        );
      }

      // Check for required scope
      if (!hasScope(tokenResult.token, "test-suites:write")) {
        return NextResponse.json(
          { error: "Missing required scope: test-suites:write" },
          { status: 403 }
        );
      }

      organizationId = tokenResult.organizationId;
    } else {
      // Session auth
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await connectDB();

    // Find the test suite
    const query: Record<string, unknown> = {
      _id: suiteId,
      projectId,
    };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const testSuite = await TestSuite.findOne(query);

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Support both single test case and array of test cases
    const testCasesToAdd = Array.isArray(body) ? body : [body];

    if (testCasesToAdd.length === 0) {
      return NextResponse.json(
        { error: "At least one test case is required" },
        { status: 400 }
      );
    }

    // Validate and normalize test cases
    const newTestCases = testCasesToAdd.map((tc) => {
      if (!tc.name || typeof tc.name !== "string" || !tc.name.trim()) {
        throw new Error("Test case name is required");
      }

      return {
        _id: new mongoose.Types.ObjectId(),
        name: tc.name.trim(),
        inputs: tc.inputs || {},
        expectedOutput: tc.expectedOutput?.trim() || "",
        notes: tc.notes?.trim() || "",
        tags: Array.isArray(tc.tags) ? tc.tags : [],
        enabled: tc.enabled !== false,
      };
    });

    // Add test cases to the suite
    testSuite.testCases.push(...newTestCases);
    await testSuite.save();

    return NextResponse.json(
      {
        success: true,
        added: newTestCases.length,
        testCases: newTestCases,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding test case:", error);
    const message = error instanceof Error ? error.message : "Failed to add test case";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/test-cases - List test cases
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId } = await params;

    let organizationId: string | undefined;

    // Check auth header to determine auth method
    const authHeader = request.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      // Token auth
      const tokenResult = await authenticateToken(request);
      if (!tokenResult.success || !tokenResult.token) {
        return NextResponse.json(
          { error: tokenResult.error || "Invalid token" },
          { status: 401 }
        );
      }

      // Check for required scope
      if (!hasScope(tokenResult.token, "test-suites:read")) {
        return NextResponse.json(
          { error: "Missing required scope: test-suites:read" },
          { status: 403 }
        );
      }

      organizationId = tokenResult.organizationId;
    } else {
      // Session auth
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await connectDB();

    // Find the test suite
    const query: Record<string, unknown> = {
      _id: suiteId,
      projectId,
    };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const testSuite = await TestSuite.findOne(query).select("testCases");

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ testCases: testSuite.testCases });
  } catch (error) {
    console.error("Error fetching test cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch test cases" },
      { status: 500 }
    );
  }
}
