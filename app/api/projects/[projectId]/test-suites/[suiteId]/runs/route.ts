import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Project from "@/lib/db/models/project";
import TestSuite from "@/lib/db/models/testSuite";
import User from "@/lib/db/models/user";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// GET /api/projects/[projectId]/test-suites/[suiteId]/runs - Get test run history
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy") || "runAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const summary = searchParams.get("summary") === "true";

    const testSuite = await TestSuite.findOne({
      _id: suiteId,
      projectId,
    }).select("runHistory name");

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    let runs = testSuite.runHistory || [];

    // Filter by status
    if (status && status !== "all") {
      runs = runs.filter((run) => run.status === status);
    }

    // Sort
    runs.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "runAt":
          comparison = new Date(a.runAt).getTime() - new Date(b.runAt).getTime();
          break;
        case "passRate":
          const rateA = a.summary.total > 0 ? a.summary.passed / a.summary.total : 0;
          const rateB = b.summary.total > 0 ? b.summary.passed / b.summary.total : 0;
          comparison = rateA - rateB;
          break;
        case "avgScore":
          comparison = (a.summary.avgScore ?? 0) - (b.summary.avgScore ?? 0);
          break;
        case "avgResponseTime":
          comparison = a.summary.avgResponseTime - b.summary.avgResponseTime;
          break;
        default:
          comparison = new Date(a.runAt).getTime() - new Date(b.runAt).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Paginate
    const total = runs.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedRuns = runs.slice(skip, skip + limit);

    // Return summary (without results) or full response
    const responseRuns = summary
      ? paginatedRuns.map((run) => ({
          _id: run._id,
          runAt: run.runAt,
          status: run.status,
          note: run.note,
          iterations: run.iterations,
          modelOverride: run.modelOverride,
          summary: run.summary,
        }))
      : paginatedRuns;

    return NextResponse.json({
      runs: responseRuns,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching test runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch test runs" },
      { status: 500 }
    );
  }
}
