import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Plus, Folder, Key, Clock, FlaskConical, FileText, Play } from "lucide-react";
import connectDB from "@/lib/db/mongodb";
import { User, Prompt, TestSuite, Endpoint, Project } from "@/lib/db/models";
import { verifyToken } from "@/lib/auth/session";

async function getDashboardStats() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  await connectDB();

  const user = await User.findById(payload.userId);
  if (!user || user.organizationIds.length === 0) {
    return null;
  }

  const orgIds = user.organizationIds;

  // Get counts and recent items
  const [promptCount, testSuiteCount, endpointCount, testSuites, recentProjects, recentTestSuites] = await Promise.all([
    Prompt.countDocuments({ organizationId: { $in: orgIds } }),
    TestSuite.countDocuments({ organizationId: { $in: orgIds } }),
    Endpoint.countDocuments({ organizationId: { $in: orgIds } }),
    TestSuite.find({ organizationId: { $in: orgIds } })
      .select("runHistory")
      .lean(),
    Project.find({ organizationId: { $in: orgIds }, isFolder: false })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select("_id name slug")
      .lean(),
    TestSuite.find({ organizationId: { $in: orgIds } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select("_id name slug projectId testCases")
      .populate("projectId", "slug")
      .lean(),
  ]);

  // Calculate test runs and average pass rate
  let totalRuns = 0;
  let totalPassed = 0;
  let totalTests = 0;

  for (const suite of testSuites) {
    if (suite.runHistory && Array.isArray(suite.runHistory)) {
      totalRuns += suite.runHistory.length;
      for (const run of suite.runHistory) {
        if (run.summary) {
          totalPassed += run.summary.passed || 0;
          totalTests += run.summary.total || 0;
        }
      }
    }
  }

  const avgPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : null;

  // Get recent activity (last 5 test runs)
  const recentActivity = await TestSuite.aggregate([
    { $match: { organizationId: { $in: orgIds } } },
    { $unwind: "$runHistory" },
    { $sort: { "runHistory.runAt": -1 } },
    { $limit: 5 },
    {
      $project: {
        name: 1,
        runAt: "$runHistory.runAt",
        status: "$runHistory.status",
        passed: "$runHistory.summary.passed",
        total: "$runHistory.summary.total",
      },
    },
  ]);

  return {
    promptCount,
    testSuiteCount,
    endpointCount,
    totalRuns,
    avgPassRate,
    recentActivity,
    recentProjects: recentProjects.map((p) => ({ _id: p._id.toString(), name: p.name, slug: p.slug })),
    recentTestSuites: recentTestSuites.map((s) => ({
      _id: s._id.toString(),
      name: s.name,
      slug: s.slug,
      projectSlug: (s.projectId as { slug?: string })?.slug || s.projectId.toString(),
      testCaseCount: s.testCases?.length || 0,
    })),
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Probefish</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">{stats?.promptCount ?? 0}</p>
            <p className="text-muted-foreground text-sm">Total Prompts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">{stats?.testSuiteCount ?? 0}</p>
            <p className="text-muted-foreground text-sm">Test Suites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">{stats?.totalRuns ?? 0}</p>
            <p className="text-muted-foreground text-sm">Test Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className={`text-3xl font-bold ${stats?.avgPassRate != null ? "text-green-600" : ""}`}>
              {stats?.avgPassRate != null ? `${stats.avgPassRate}%` : "--"}
            </p>
            <p className="text-muted-foreground text-sm">Avg Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats?.recentTestSuites && stats.recentTestSuites.length > 0 ? (
              <>
                {stats.recentTestSuites.slice(0, 2).map((suite) => (
                  <Button key={suite._id} variant="secondary" asChild className="justify-start">
                    <Link href={`/projects/${suite.projectSlug}/test-suites/${suite.slug}`}>
                      <Play className="mr-2 h-4 w-4" />
                      Run: {suite.name} ({suite.testCaseCount} tests)
                    </Link>
                  </Button>
                ))}
                {stats.recentProjects && stats.recentProjects.length > 0 && (
                  <Button variant="outline" asChild className="justify-start">
                    <Link href={`/projects/${stats.recentProjects[0].slug}/test-suites/new`}>
                      <FlaskConical className="mr-2 h-4 w-4" />
                      New Test Suite in {stats.recentProjects[0].name}
                    </Link>
                  </Button>
                )}
              </>
            ) : stats?.recentProjects && stats.recentProjects.length > 0 ? (
              <>
                <Button asChild className="justify-start">
                  <Link href={`/projects/${stats.recentProjects[0].slug}/prompts/new`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Create Prompt in {stats.recentProjects[0].name}
                  </Link>
                </Button>
                <Button variant="secondary" asChild className="justify-start">
                  <Link href={`/projects/${stats.recentProjects[0].slug}/test-suites/new`}>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Create Test Suite
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild className="justify-start">
                  <Link href="/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Project
                  </Link>
                </Button>
                <Button variant="secondary" asChild className="justify-start">
                  <Link href="/settings/organization/api-keys">
                    <Key className="mr-2 h-4 w-4" />
                    Configure API Keys
                  </Link>
                </Button>
              </>
            )}
            <Button variant="ghost" asChild className="justify-start text-muted-foreground">
              <Link href="/projects">
                <Folder className="mr-2 h-4 w-4" />
                All Projects
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{activity.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {activity.passed}/{activity.total} passed
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(activity.runAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-muted-foreground/70 text-sm">Start by creating a project</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Set up your environment to start testing LLM prompts and API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">1</span>
              </div>
              <div>
                <h3 className="font-medium">Configure API Keys</h3>
                <p className="text-muted-foreground text-sm">
                  Add your OpenAI, Anthropic, or Gemini API keys in{" "}
                  <Link href="/settings/organization/api-keys" className="text-primary hover:underline">
                    Settings
                  </Link>.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">2</span>
              </div>
              <div>
                <h3 className="font-medium">Create a Project</h3>
                <p className="text-muted-foreground text-sm">
                  Projects contain prompts, endpoints, and test suites. Create one to get started.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">3</span>
              </div>
              <div>
                <h3 className="font-medium">Add Prompts or Endpoints</h3>
                <p className="text-muted-foreground text-sm">
                  Create prompts with variables like {"{{name}}"}, or configure HTTP API endpoints to test.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">4</span>
              </div>
              <div>
                <h3 className="font-medium">Create Test Suites</h3>
                <p className="text-muted-foreground text-sm">
                  Define test cases, validation rules, and LLM judge criteria to evaluate outputs.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
