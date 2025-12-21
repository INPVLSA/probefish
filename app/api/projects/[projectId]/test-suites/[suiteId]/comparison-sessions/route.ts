import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import TestSuite, { ITestRun } from "@/lib/db/models/testSuite";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/comparison-sessions
// Get all comparison sessions for a test suite
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId, suiteId } = await params;

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
    });

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessions: testSuite.comparisonSessions || [],
    });
  } catch (error) {
    console.error("Error fetching comparison sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison sessions" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/test-suites/[suiteId]/comparison-sessions
// Save a new comparison session
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId, suiteId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request,
    ["test-runs:execute"]
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

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
    const { models, runs } = body;

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: "Models array is required" },
        { status: 400 }
      );
    }

    if (!runs || !Array.isArray(runs) || runs.length === 0) {
      return NextResponse.json(
        { error: "Runs array is required" },
        { status: 400 }
      );
    }

    // Create comparison session
    const session = {
      _id: new mongoose.Types.ObjectId(),
      runAt: new Date(),
      runBy: new mongoose.Types.ObjectId(auth.context.user.id),
      models: models.map((m: { provider: string; model: string; isPrimary?: boolean }) => ({
        provider: m.provider as "openai" | "anthropic" | "gemini",
        model: m.model,
        isPrimary: m.isPrimary || false,
      })),
      runs: runs.map((run: {
        _id?: string;
        runAt?: string;
        status: string;
        modelOverride?: { provider: string; model: string };
        results: unknown[];
        summary: {
          total: number;
          passed: number;
          failed: number;
          avgScore?: number;
          avgResponseTime: number;
        };
      }) => ({
        _id: run._id ? new mongoose.Types.ObjectId(run._id) : new mongoose.Types.ObjectId(),
        runAt: run.runAt ? new Date(run.runAt) : new Date(),
        runBy: new mongoose.Types.ObjectId(auth.context!.user.id),
        status: run.status as "running" | "completed" | "failed",
        modelOverride: run.modelOverride,
        results: run.results as ITestRun["results"],
        summary: run.summary,
      })),
    };

    // Add to comparison sessions (keep last 20)
    if (!testSuite.comparisonSessions) {
      testSuite.comparisonSessions = [];
    }
    testSuite.comparisonSessions.unshift(session);
    if (testSuite.comparisonSessions.length > 20) {
      testSuite.comparisonSessions = testSuite.comparisonSessions.slice(0, 20);
    }

    testSuite.markModified("comparisonSessions");
    await testSuite.save();

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error saving comparison session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save comparison session",
      },
      { status: 500 }
    );
  }
}
