import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

interface TestCaseComparison {
  testCaseId: string;
  testCaseName: string;
  suiteId: string;
  suiteName: string;
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

interface SuiteComparison {
  suiteId: string;
  suiteName: string;
  targetType: string;
  targetName: string;
  baseline: {
    runId: string;
    runAt: Date;
    passed: number;
    failed: number;
    total: number;
    avgScore?: number;
  } | null;
  compare: {
    runId: string;
    runAt: Date;
    passed: number;
    failed: number;
    total: number;
    avgScore?: number;
  } | null;
  status: "improved" | "regressed" | "unchanged" | "new" | "removed" | "not-run";
  passRateDelta?: number;
  testCases: TestCaseComparison[];
}

// GET /api/projects/[projectId]/compare?baselineDate=ISO&compareDate=ISO
// Compares the latest runs before each date across all suites
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const baselineDateStr = searchParams.get("baselineDate");
    const compareDateStr = searchParams.get("compareDate");

    if (!baselineDateStr || !compareDateStr) {
      return NextResponse.json(
        { error: "Both baselineDate and compareDate are required" },
        { status: 400 }
      );
    }

    const baselineDate = new Date(baselineDateStr);
    const compareDate = new Date(compareDateStr);

    if (isNaN(baselineDate.getTime()) || isNaN(compareDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
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

    // Get all test suites with run history
    const testSuites = await TestSuite.find({ projectId })
      .select("_id name targetType targetId runHistory")
      .lean();

    // Get target names
    const Prompt = (await import("@/lib/db/models/prompt")).default;
    const Endpoint = (await import("@/lib/db/models/endpoint")).default;

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

    // Build comparison for each suite
    const suiteComparisons: SuiteComparison[] = [];
    let totalImproved = 0;
    let totalRegressed = 0;
    let totalUnchanged = 0;
    let totalNew = 0;
    let totalRemoved = 0;
    let suitesImproved = 0;
    let suitesRegressed = 0;
    let suitesUnchanged = 0;

    for (const suite of testSuites) {
      const targetName = targetNames[suite.targetId.toString()] || "Unknown";
      const runs = suite.runHistory || [];

      // Find latest run before each date
      const baselineRun = runs
        .filter((r) => new Date(r.runAt) <= baselineDate && r.status === "completed")
        .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())[0];

      const compareRun = runs
        .filter((r) => new Date(r.runAt) <= compareDate && r.status === "completed")
        .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())[0];

      const suiteComparison: SuiteComparison = {
        suiteId: suite._id.toString(),
        suiteName: suite.name,
        targetType: suite.targetType,
        targetName,
        baseline: null,
        compare: null,
        status: "not-run",
        testCases: [],
      };

      if (!baselineRun && !compareRun) {
        suiteComparison.status = "not-run";
        suiteComparisons.push(suiteComparison);
        continue;
      }

      if (baselineRun) {
        suiteComparison.baseline = {
          runId: baselineRun._id.toString(),
          runAt: baselineRun.runAt,
          passed: baselineRun.summary.passed,
          failed: baselineRun.summary.failed,
          total: baselineRun.summary.total,
          avgScore: baselineRun.summary.avgScore,
        };
      }

      if (compareRun) {
        suiteComparison.compare = {
          runId: compareRun._id.toString(),
          runAt: compareRun.runAt,
          passed: compareRun.summary.passed,
          failed: compareRun.summary.failed,
          total: compareRun.summary.total,
          avgScore: compareRun.summary.avgScore,
        };
      }

      // Build test case comparisons
      const baselineResultsMap = new Map(
        (baselineRun?.results || []).map((r) => [r.testCaseId.toString(), r])
      );
      const compareResultsMap = new Map(
        (compareRun?.results || []).map((r) => [r.testCaseId.toString(), r])
      );

      const allTestCaseIds = new Set([
        ...baselineResultsMap.keys(),
        ...compareResultsMap.keys(),
      ]);

      let suiteImproved = 0;
      let suiteRegressed = 0;
      let suiteUnchanged = 0;
      let suiteNew = 0;
      let suiteRemoved = 0;

      for (const testCaseId of allTestCaseIds) {
        const baselineResult = baselineResultsMap.get(testCaseId);
        const compareResult = compareResultsMap.get(testCaseId);

        const tcComparison: TestCaseComparison = {
          testCaseId,
          testCaseName:
            compareResult?.testCaseName ||
            baselineResult?.testCaseName ||
            "Unknown",
          suiteId: suite._id.toString(),
          suiteName: suite.name,
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

        if (!baselineResult && compareResult) {
          tcComparison.status = "new";
          suiteNew++;
          totalNew++;
        } else if (baselineResult && !compareResult) {
          tcComparison.status = "removed";
          suiteRemoved++;
          totalRemoved++;
        } else if (baselineResult && compareResult) {
          const baselinePassed = baselineResult.validationPassed;
          const comparePassed = compareResult.validationPassed;

          if (
            baselineResult.judgeScore !== undefined &&
            compareResult.judgeScore !== undefined
          ) {
            tcComparison.scoreDelta =
              compareResult.judgeScore - baselineResult.judgeScore;
          }
          tcComparison.responseTimeDelta =
            compareResult.responseTime - baselineResult.responseTime;

          if (!baselinePassed && comparePassed) {
            tcComparison.status = "improved";
            suiteImproved++;
            totalImproved++;
          } else if (baselinePassed && !comparePassed) {
            tcComparison.status = "regressed";
            suiteRegressed++;
            totalRegressed++;
          } else if (
            tcComparison.scoreDelta !== undefined &&
            Math.abs(tcComparison.scoreDelta) > 0.05
          ) {
            if (tcComparison.scoreDelta > 0) {
              tcComparison.status = "improved";
              suiteImproved++;
              totalImproved++;
            } else {
              tcComparison.status = "regressed";
              suiteRegressed++;
              totalRegressed++;
            }
          } else {
            tcComparison.status = "unchanged";
            suiteUnchanged++;
            totalUnchanged++;
          }
        }

        suiteComparison.testCases.push(tcComparison);
      }

      // Sort test cases: regressed first
      const statusOrder = {
        regressed: 0,
        improved: 1,
        new: 2,
        unchanged: 3,
        removed: 4,
      };
      suiteComparison.testCases.sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );

      // Determine suite-level status
      if (!baselineRun && compareRun) {
        suiteComparison.status = "new";
      } else if (baselineRun && !compareRun) {
        suiteComparison.status = "removed";
      } else if (baselineRun && compareRun) {
        const baselinePassRate =
          baselineRun.summary.total > 0
            ? baselineRun.summary.passed / baselineRun.summary.total
            : 0;
        const comparePassRate =
          compareRun.summary.total > 0
            ? compareRun.summary.passed / compareRun.summary.total
            : 0;

        suiteComparison.passRateDelta =
          Math.round((comparePassRate - baselinePassRate) * 1000) / 10;

        if (suiteRegressed > 0) {
          suiteComparison.status = "regressed";
          suitesRegressed++;
        } else if (suiteImproved > 0) {
          suiteComparison.status = "improved";
          suitesImproved++;
        } else {
          suiteComparison.status = "unchanged";
          suitesUnchanged++;
        }
      }

      suiteComparisons.push(suiteComparison);
    }

    // Sort suites: regressed first
    const suiteStatusOrder = {
      regressed: 0,
      improved: 1,
      new: 2,
      unchanged: 3,
      removed: 4,
      "not-run": 5,
    };
    suiteComparisons.sort(
      (a, b) => suiteStatusOrder[a.status] - suiteStatusOrder[b.status]
    );

    return NextResponse.json({
      baselineDate,
      compareDate,
      summary: {
        totalSuites: testSuites.length,
        suitesCompared: suiteComparisons.filter(
          (s) => s.status !== "not-run"
        ).length,
        suitesImproved,
        suitesRegressed,
        suitesUnchanged,
        totalTestCases: totalImproved + totalRegressed + totalUnchanged + totalNew + totalRemoved,
        improved: totalImproved,
        regressed: totalRegressed,
        unchanged: totalUnchanged,
        new: totalNew,
        removed: totalRemoved,
      },
      suites: suiteComparisons,
    });
  } catch (error) {
    console.error("Error comparing project test runs:", error);
    return NextResponse.json(
      { error: "Failed to compare test runs" },
      { status: 500 }
    );
  }
}
