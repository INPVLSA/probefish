"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  ArrowLeft,
  FileText,
  MoreVertical,
  Pencil,
  GitBranch,
  Tag,
  Globe,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Settings,
  Building2,
  EyeOff,
  Shield,
  Activity,
  Webhook,
  Search,
  GitCompare,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { DeleteIcon } from "@/components/ui/delete";
import { toast } from "sonner";
import { ProjectTestsDashboard } from "@/components/testing";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  _id: string;
  name: string;
  description?: string;
  isFolder: boolean;
  visibility?: "public" | "private";
}

interface Prompt {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  currentVersion: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Endpoint {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  config: {
    method: string;
    url: string;
  };
  variables: string[];
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error";
  createdAt: string;
  updatedAt: string;
}

interface TestSuite {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  targetType: "prompt" | "endpoint";
  targetId: string;
  testCases: unknown[];
  parallelExecution?: boolean;
  lastRun?: {
    status: string;
    runAt: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
    };
  };
  updatedAt: string;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  // Tab state with URL hash sync
  const validTabs = ["test-results", "prompts", "endpoints", "test-suites"];
  const [activeTab, setActiveTab] = useState("test-results");

  // Read hash on mount and handle hash changes
  useEffect(() => {
    const getTabFromHash = () => {
      const hash = window.location.hash.slice(1); // Remove #
      return validTabs.includes(hash) ? hash : "test-results";
    };

    setActiveTab(getTabFromHash());

    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, "", `#${value}`);
  }, []);

  const [project, setProject] = useState<Project | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project
        const projectRes = await fetch(`/api/projects/${projectId}`);
        const projectData = await projectRes.json();

        if (!projectRes.ok) {
          setError(projectData.error || "Failed to fetch project");
          return;
        }

        setProject(projectData.project);
        setUserRole(projectData.userRole || null);

        // Fetch prompts, endpoints, and test suites in parallel
        const [promptsRes, endpointsRes, testSuitesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/prompts`),
          fetch(`/api/projects/${projectId}/endpoints`),
          fetch(`/api/projects/${projectId}/test-suites`),
        ]);

        const [promptsData, endpointsData, testSuitesData] = await Promise.all([
          promptsRes.json(),
          endpointsRes.json(),
          testSuitesRes.json(),
        ]);

        if (promptsRes.ok) {
          setPrompts(promptsData.prompts);
        }

        if (endpointsRes.ok) {
          setEndpoints(endpointsData.endpoints);
        }

        if (testSuitesRes.ok) {
          setTestSuites(testSuitesData.testSuites);
        }
      } catch {
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/prompts/${promptId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setPrompts(prompts.filter((p) => p._id !== promptId));
        toast.success("Prompt deleted!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete prompt");
      }
    } catch {
      toast.error("Failed to delete prompt");
    }
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!confirm("Are you sure you want to delete this endpoint?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/endpoints/${endpointId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setEndpoints(endpoints.filter((e) => e._id !== endpointId));
        toast.success("Endpoint deleted!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete endpoint");
      }
    } catch {
      toast.error("Failed to delete endpoint");
    }
  };

  const handleDeleteTestSuite = async (suiteId: string) => {
    if (!confirm("Are you sure you want to delete this test suite?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setTestSuites(testSuites.filter((s) => s._id !== suiteId));
        toast.success("Test suite deleted!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete test suite");
      }
    } catch {
      toast.error("Failed to delete test suite");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header - real buttons, skeleton for data */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild title="Webhooks">
              <Link href={`/projects/${projectId}/settings/webhooks`}>
                <Webhook className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild title="CI/CD">
              <Link href={`/projects/${projectId}/settings/cicd`}>
                <GitBranch className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild title="Settings">
              <Link href={`/projects/${projectId}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs - real buttons, skeleton for counts and content */}
        <div className="flex flex-col gap-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex h-9 items-center gap-0.5 p-[3px] bg-muted rounded-lg">
              <Skeleton className="h-[calc(100%-1px)] w-28 rounded-md" />
              <Skeleton className="h-[calc(100%-1px)] w-20 rounded-md" />
              <Skeleton className="h-[calc(100%-1px)] w-24 rounded-md" />
              <Skeleton className="h-[calc(100%-1px)] w-24 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/projects/${projectId}/endpoints/new`}>
                  <Globe className="h-4 w-4" />
                  New Endpoint
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/projects/${projectId}/prompts/new`}>
                  <FileText className="h-4 w-4" />
                  New Prompt
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/projects/${projectId}/test-suites/new`}>
                  <FlaskConical className="h-4 w-4" />
                  New Test Suite
                </Link>
              </Button>
            </div>
          </div>

          {/* Content skeleton - matches Test Results tab (default) */}
          <div className="space-y-6">
            {/* Summary Cards Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="text-center">
                    <Skeleton className="h-7 w-12 mx-auto mb-2" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suites..."
                  value=""
                  disabled
                  readOnly
                  className="pl-8"
                />
              </div>
              <Select disabled>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Suites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suites</SelectItem>
                  <SelectItem value="passing">Passing</SelectItem>
                  <SelectItem value="failing">Failing</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" disabled>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Runs
              </Button>
            </div>

            {/* Two Column Layout Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Test Suites */}
              <Card>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="p-0 min-h-[280px]">
                  <div className="space-y-3 p-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Recent Runs */}
              <Card>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-44" />
                </CardHeader>
                <CardContent className="p-0 min-h-[280px]">
                  <div className="space-y-3 p-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg">
          {error || "Project not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge
              variant={project.visibility === "private" ? "secondary" : "outline"}
              className="gap-1"
            >
              {project.visibility === "private" ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Private
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3" />
                  Organization
                </>
              )}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userRole && (
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {userRole === "full" ? "Full Access" : userRole}
            </Badge>
          )}
          <Button variant="outline" size="icon" asChild title="Webhooks">
            <Link href={`/projects/${projectId}/settings/webhooks`}>
              <Webhook className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild title="CI/CD">
            <Link href={`/projects/${projectId}/settings/cicd`}>
              <GitBranch className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild title="Settings">
            <Link href={`/projects/${projectId}/settings`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="test-results" className="gap-2">
              <Activity className="h-4 w-4" />
              Test Results
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-2">
              <FileText className="h-4 w-4" />
              Prompts
              {prompts.length > 0 && (
                <Badge variant="secondary">
                  {prompts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="gap-2">
              <Globe className="h-4 w-4" />
              Endpoints
              {endpoints.length > 0 && (
                <Badge variant="secondary">
                  {endpoints.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="test-suites" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Test Suites
              {testSuites.length > 0 && (
                <Badge variant="secondary">
                  {testSuites.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/endpoints/new`}>
                <Globe className="h-4 w-4" />
                New Endpoint
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/prompts/new`}>
                <FileText className="h-4 w-4" />
                New Prompt
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/projects/${projectId}/test-suites/new`}>
                <FlaskConical className="h-4 w-4" />
                New Test Suite
              </Link>
            </Button>
          </div>
        </div>

        {/* Test Results Tab */}
        <TabsContent value="test-results" className="space-y-3">
          <ProjectTestsDashboard projectId={projectId} />
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-3">
          {prompts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No prompts yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first prompt in this project
                </p>
                <Button asChild>
                  <Link href={`/projects/${projectId}/prompts/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Prompt
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            prompts.map((prompt) => (
              <Link
                key={prompt._id}
                href={`/projects/${projectId}/prompts/${prompt.slug}`}
                className="block"
              >
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="py-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {prompt.name}
                          </CardTitle>
                          {prompt.description && (
                            <CardDescription className="mt-0.5 line-clamp-1">
                              {prompt.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            v{prompt.currentVersion}
                          </span>
                          {prompt.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {prompt.tags.length}
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(prompt.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/projects/${projectId}/prompts/${prompt.slug}`}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeletePrompt(prompt._id);
                              }}
                              className="text-destructive"
                            >
                              <DeleteIcon size={16} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-3">
          {endpoints.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No endpoints yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Configure an external HTTP API endpoint to test
                </p>
                <Button asChild>
                  <Link href={`/projects/${projectId}/endpoints/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Endpoint
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            endpoints.map((endpoint) => (
              <Link
                key={endpoint._id}
                href={`/projects/${projectId}/endpoints/${endpoint.slug}`}
                className="block"
              >
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="py-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Globe className="h-5 w-5 text-green-500" />
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {endpoint.name}
                          </CardTitle>
                          <CardDescription className="mt-0.5 line-clamp-1 font-mono text-xs">
                            <Badge variant="outline" className="mr-2">
                              {endpoint.config.method}
                            </Badge>
                            {endpoint.config.url}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                          {endpoint.lastTestStatus && (
                            <span className="flex items-center gap-1">
                              {endpoint.lastTestStatus === "success" ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )}
                              {endpoint.lastTestStatus}
                            </span>
                          )}
                          {endpoint.variables.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {endpoint.variables.length} vars
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(endpoint.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/projects/${projectId}/endpoints/${endpoint.slug}`}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteEndpoint(endpoint._id);
                              }}
                              className="text-destructive"
                            >
                              <DeleteIcon size={16} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Test Suites Tab */}
        <TabsContent value="test-suites" className="space-y-3">
          {testSuites.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FlaskConical className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No test suites yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create a test suite to evaluate prompts or endpoints
                </p>
                <Button asChild>
                  <Link href={`/projects/${projectId}/test-suites/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Test Suite
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            testSuites.map((suite) => (
              <Link
                key={suite._id}
                href={`/projects/${projectId}/test-suites/${suite.slug}`}
                className="block"
              >
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="py-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FlaskConical className="h-5 w-5 text-purple-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base group-hover:text-primary transition-colors">
                              {suite.name}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className={
                                suite.targetType === "prompt"
                                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                  : "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                              }
                            >
                              {suite.targetType === "prompt" ? (
                                <>
                                  <FileText className="h-3 w-3 mr-1" />
                                  Prompt
                                </>
                              ) : (
                                <>
                                  <Globe className="h-3 w-3 mr-1" />
                                  API
                                </>
                              )}
                            </Badge>
                            {suite.parallelExecution && (
                              <Badge
                                variant="secondary"
                                className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                Parallel
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-0.5">
                            {suite.testCases.length} test case
                            {suite.testCases.length !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                          {suite.lastRun && (
                            <span className="flex items-center gap-1">
                              {suite.lastRun.summary.failed === 0 ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )}
                              {suite.lastRun.summary.passed}/{suite.lastRun.summary.total}
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(suite.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/projects/${projectId}/test-suites/${suite.slug}`}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteTestSuite(suite._id);
                              }}
                              className="text-destructive"
                            >
                              <DeleteIcon size={16} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
