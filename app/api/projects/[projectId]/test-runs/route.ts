import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/test-runs - Get all test runs for a project with summary
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const includeSummary = searchParams.get("summary") !== "false";

    // Get all test suites for this project
    const testSuites = await TestSuite.find({ projectId })
      .select("_id name targetType targetId runHistory lastRun")
      .lean();

    // Get target names for display
    const promptIds = testSuites
      .filter((s) => s.targetType === "prompt")
      .map((s) => s.targetId);
    const endpointIds = testSuites
      .filter((s) => s.targetType === "endpoint")
      .map((s) => s.targetId);

    const [prompts, endpoints] = await Promise.all([
      Prompt.find({ _id: { $in: promptIds } }).select("_id name").lean(),
      Endpoint.find({ _id: { $in: endpointIds } }).select("_id name").lean(),
    ]);

    const targetNames: Record<string, string> = {};
    prompts.forEach((p) => {
      targetNames[p._id.toString()] = p.name;
    });
    endpoints.forEach((e) => {
      targetNames[e._id.toString()] = e.name;
    });

    // Collect all runs from all suites with suite info
    interface RunWithSuiteInfo {
      _id: string;
      runAt: Date;
      status: string;
      summary: {
        total: number;
        passed: number;
        failed: number;
        avgScore?: number;
        avgResponseTime: number;
      };
      suiteId: string;
      suiteName: string;
      targetType: string;
      targetName: string;
    }

    const allRuns: RunWithSuiteInfo[] = [];

    for (const suite of testSuites) {
      const targetName = targetNames[suite.targetId.toString()] || "Unknown";

      if (suite.runHistory && Array.isArray(suite.runHistory)) {
        for (const run of suite.runHistory) {
          allRuns.push({
            _id: run._id.toString(),
            runAt: run.runAt,
            status: run.status,
            summary: run.summary,
            suiteId: suite._id.toString(),
            suiteName: suite.name,
            targetType: suite.targetType,
            targetName,
          });
        }
      }
    }

    // Sort by runAt descending
    allRuns.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());

    // Paginate
    const total = allRuns.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedRuns = allRuns.slice(skip, skip + limit);

    // Build summary from latest runs per suite
    let summary = null;
    if (includeSummary) {
      const latestRunsBySuite: Record<string, RunWithSuiteInfo> = {};

      for (const run of allRuns) {
        if (!latestRunsBySuite[run.suiteId] ||
            new Date(run.runAt) > new Date(latestRunsBySuite[run.suiteId].runAt)) {
          latestRunsBySuite[run.suiteId] = run;
        }
      }

      const latestRuns = Object.values(latestRunsBySuite);

      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      let totalScoreSum = 0;
      let scoreCount = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      let suitesWithFailures = 0;
      let suitesAllPassing = 0;
      let suitesNeverRun = 0;

      // Count suites that have never been run
      for (const suite of testSuites) {
        if (!suite.runHistory || suite.runHistory.length === 0) {
          suitesNeverRun++;
        }
      }

      for (const run of latestRuns) {
        if (run.status === "completed" || run.status === "failed") {
          totalTests += run.summary.total;
          totalPassed += run.summary.passed;
          totalFailed += run.summary.failed;

          if (run.summary.avgScore !== undefined) {
            totalScoreSum += run.summary.avgScore;
            scoreCount++;
          }

          if (run.summary.avgResponseTime) {
            totalResponseTime += run.summary.avgResponseTime;
            responseTimeCount++;
          }

          if (run.summary.failed > 0) {
            suitesWithFailures++;
          } else if (run.summary.total > 0) {
            suitesAllPassing++;
          }
        }
      }

      const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : null;
      const avgScore = scoreCount > 0 ? totalScoreSum / scoreCount : null;
      const avgResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : null;

      summary = {
        totalSuites: testSuites.length,
        suitesWithRuns: latestRuns.length,
        suitesNeverRun,
        suitesAllPassing,
        suitesWithFailures,
        totalTests,
        totalPassed,
        totalFailed,
        passRate: passRate !== null ? Math.round(passRate * 10) / 10 : null,
        avgScore: avgScore !== null ? Math.round(avgScore * 1000) / 10 : null, // Convert to percentage
        avgResponseTime,
        latestRuns: latestRuns.map((run) => ({
          suiteId: run.suiteId,
          suiteName: run.suiteName,
          targetType: run.targetType,
          targetName: run.targetName,
          runAt: run.runAt,
          status: run.status,
          passed: run.summary.passed,
          failed: run.summary.failed,
          total: run.summary.total,
          avgScore: run.summary.avgScore,
          passRate: run.summary.total > 0
            ? Math.round((run.summary.passed / run.summary.total) * 1000) / 10
            : null,
        })),
      };
    }

    return NextResponse.json({
      runs: paginatedRuns,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary,
    });
  } catch (error) {
    console.error("Error fetching project test runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch test runs" },
      { status: 500 }
    );
  }
}
