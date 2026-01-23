import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import { authenticateToken, hasScope } from "@/lib/auth/tokenAuth";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";
import mongoose from "mongoose";
import {
  resolveProjectAcrossOrgs,
  resolveTestSuiteByIdentifier,
} from "@/lib/utils/resolve-identifier";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// POST /api/projects/[projectId]/test-suites/[suiteId]/test-cases - Add test case(s)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, suiteId } = await params;

    await connectDB();

    let testSuite;

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

      // For token auth, use organization scoped query
      const query: Record<string, unknown> = {
        _id: suiteId,
        projectId,
      };
      if (tokenResult.organizationId) {
        query.organizationId = tokenResult.organizationId;
      }
      testSuite = await TestSuite.findOne(query);
    } else {
      // Session auth - use resolver functions for slug support
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

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

      // Resolve test suite by ID or slug
      testSuite = await resolveTestSuiteByIdentifier(suiteId, project._id);
    }

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

    await connectDB();

    let testSuiteId: string;

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

      // For token auth, use organization scoped query
      const query: Record<string, unknown> = {
        _id: suiteId,
        projectId,
      };
      if (tokenResult.organizationId) {
        query.organizationId = tokenResult.organizationId;
      }
      const suite = await TestSuite.findOne(query).select("_id");
      if (!suite) {
        return NextResponse.json(
          { error: "Test suite not found" },
          { status: 404 }
        );
      }
      testSuiteId = suite._id.toString();
    } else {
      // Session auth - use resolver functions for slug support
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

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

      // Resolve test suite by ID or slug
      const resolvedSuite = await resolveTestSuiteByIdentifier(suiteId, project._id);
      if (!resolvedSuite) {
        return NextResponse.json(
          { error: "Test suite not found" },
          { status: 404 }
        );
      }
      testSuiteId = resolvedSuite._id.toString();
    }

    const testSuite = await TestSuite.findById(testSuiteId).select("testCases");

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "0", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const total = testSuite.testCases.length;
    let testCases = testSuite.testCases;

    if (limit > 0) {
      testCases = testSuite.testCases.slice(offset, offset + limit);
    }

    return NextResponse.json({
      testCases,
      pagination: { total, limit: limit || total, offset },
    });
  } catch (error) {
    console.error("Error fetching test cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch test cases" },
      { status: 500 }
    );
  }
}
