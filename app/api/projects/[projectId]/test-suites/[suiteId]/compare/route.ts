import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

interface TestCaseComparison {
  testCaseId: string;
  testCaseName: string;
  baseline: {
    passed: boolean;
    score?: number;
    responseTime: number;
    output: string;
    error?: string;
    validationErrors: string[];
  } | null;
  compare: {
    passed: boolean;
    score?: number;
    responseTime: number;
    output: string;
    error?: string;
    validationErrors: string[];
  } | null;
  status: "improved" | "regressed" | "unchanged" | "new" | "removed";
  scoreDelta?: number;
  responseTimeDelta?: number;
}

interface ComparisonResult {
  baseline: {
    runId: string;
    runAt: Date;
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    };
  };
  compare: {
    runId: string;
    runAt: Date;
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    };
  };
  summary: {
    improved: number;
    regressed: number;
    unchanged: number;
    new: number;
    removed: number;
    passRateDelta: number;
    avgScoreDelta?: number;
    avgResponseTimeDelta: number;
  };
  testCases: TestCaseComparison[];
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/compare?baseline=runId&compare=runId
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, suiteId } = await params;
    const { searchParams } = new URL(request.url);
    const baselineRunId = searchParams.get("baseline");
    const compareRunId = searchParams.get("compare");

    if (!baselineRunId || !compareRunId) {
      return NextResponse.json(
        { error: "Both baseline and compare run IDs are required" },
        { status: 400 }
      );
    }

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

    // Find the two runs
    const baselineRun = testSuite.runHistory.find(
      (run) => run._id.toString() === baselineRunId
    );
    const compareRun = testSuite.runHistory.find(
      (run) => run._id.toString() === compareRunId
    );

    if (!baselineRun) {
      return NextResponse.json(
        { error: "Baseline run not found" },
        { status: 404 }
      );
    }

    if (!compareRun) {
      return NextResponse.json(
        { error: "Compare run not found" },
        { status: 404 }
      );
    }

    // Build comparison
    const baselineResultsMap = new Map(
      baselineRun.results.map((r) => [r.testCaseId.toString(), r])
    );
    const compareResultsMap = new Map(
      compareRun.results.map((r) => [r.testCaseId.toString(), r])
    );

    // Get all unique test case IDs
    const allTestCaseIds = new Set([
      ...baselineResultsMap.keys(),
      ...compareResultsMap.keys(),
    ]);

    const testCases: TestCaseComparison[] = [];
    let improved = 0;
    let regressed = 0;
    let unchanged = 0;
    let newTests = 0;
    let removed = 0;

    for (const testCaseId of allTestCaseIds) {
      const baselineResult = baselineResultsMap.get(testCaseId);
      const compareResult = compareResultsMap.get(testCaseId);

      const comparison: TestCaseComparison = {
        testCaseId,
        testCaseName:
          compareResult?.testCaseName ||
          baselineResult?.testCaseName ||
          "Unknown",
        baseline: baselineResult
          ? {
              passed: baselineResult.validationPassed,
              score: baselineResult.judgeScore,
              responseTime: baselineResult.responseTime,
              output: baselineResult.output || "",
              error: baselineResult.error,
              validationErrors: baselineResult.validationErrors || [],
            }
          : null,
        compare: compareResult
          ? {
              passed: compareResult.validationPassed,
              score: compareResult.judgeScore,
              responseTime: compareResult.responseTime,
              output: compareResult.output || "",
              error: compareResult.error,
              validationErrors: compareResult.validationErrors || [],
            }
          : null,
        status: "unchanged",
      };

      // Determine status
      if (!baselineResult && compareResult) {
        comparison.status = "new";
        newTests++;
      } else if (baselineResult && !compareResult) {
        comparison.status = "removed";
        removed++;
      } else if (baselineResult && compareResult) {
        const baselinePassed = baselineResult.validationPassed;
        const comparePassed = compareResult.validationPassed;

        // Calculate deltas
        if (
          baselineResult.judgeScore !== undefined &&
          compareResult.judgeScore !== undefined
        ) {
          comparison.scoreDelta =
            compareResult.judgeScore - baselineResult.judgeScore;
        }
        comparison.responseTimeDelta =
          compareResult.responseTime - baselineResult.responseTime;

        // Determine if improved or regressed
        if (!baselinePassed && comparePassed) {
          comparison.status = "improved";
          improved++;
        } else if (baselinePassed && !comparePassed) {
          comparison.status = "regressed";
          regressed++;
        } else if (
          comparison.scoreDelta !== undefined &&
          Math.abs(comparison.scoreDelta) > 0.05
        ) {
          // Score changed significantly (>5%)
          if (comparison.scoreDelta > 0) {
            comparison.status = "improved";
            improved++;
          } else {
            comparison.status = "regressed";
            regressed++;
          }
        } else {
          comparison.status = "unchanged";
          unchanged++;
        }
      }

      testCases.push(comparison);
    }

    // Sort: regressed first, then improved, then new, then unchanged, then removed
    const statusOrder = {
      regressed: 0,
      improved: 1,
      new: 2,
      unchanged: 3,
      removed: 4,
    };
    testCases.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Calculate summary deltas
    const baselinePassRate =
      baselineRun.summary.total > 0
        ? (baselineRun.summary.passed / baselineRun.summary.total) * 100
        : 0;
    const comparePassRate =
      compareRun.summary.total > 0
        ? (compareRun.summary.passed / compareRun.summary.total) * 100
        : 0;

    const result: ComparisonResult = {
      baseline: {
        runId: baselineRun._id.toString(),
        runAt: baselineRun.runAt,
        summary: baselineRun.summary,
      },
      compare: {
        runId: compareRun._id.toString(),
        runAt: compareRun.runAt,
        summary: compareRun.summary,
      },
      summary: {
        improved,
        regressed,
        unchanged,
        new: newTests,
        removed,
        passRateDelta: Math.round((comparePassRate - baselinePassRate) * 10) / 10,
        avgScoreDelta:
          baselineRun.summary.avgScore !== undefined &&
          compareRun.summary.avgScore !== undefined
            ? Math.round(
                (compareRun.summary.avgScore - baselineRun.summary.avgScore) *
                  1000
              ) / 10
            : undefined,
        avgResponseTimeDelta:
          compareRun.summary.avgResponseTime - baselineRun.summary.avgResponseTime,
      },
      testCases,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error comparing test runs:", error);
    return NextResponse.json(
      { error: "Failed to compare test runs" },
      { status: 500 }
    );
  }
}
