"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Search,
  FlaskConical,
  FileText,
  Globe,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface TestCaseResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  judgeScore?: number;
  responseTime: number;
  error?: string;
  validationErrors: string[];
}

interface LatestRun {
  suiteId: string;
  suiteName: string;
  targetType: "prompt" | "endpoint";
  targetName: string;
  runAt: string;
  status: string;
  passed: number;
  failed: number;
  total: number;
  avgScore?: number;
  passRate: number | null;
  testCases?: TestCaseResult[];
}

interface ProjectTestsSummary {
  totalSuites: number;
  suitesWithRuns: number;
  suitesNeverRun: number;
  suitesAllPassing: number;
  suitesWithFailures: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number | null;
  avgScore: number | null;
  avgResponseTime: number | null;
  latestRuns: LatestRun[];
}

interface TestRun {
  _id: string;
  runAt: string;
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

interface ProjectTestsDashboardProps {
  projectId: string;
}

type SortField = "suiteName" | "runAt" | "passRate" | "avgScore" | "total";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "passing" | "failing" | "never-run";

export function ProjectTestsDashboard({ projectId }: ProjectTestsDashboardProps) {
  const [summary, setSummary] = useState<ProjectTestsSummary | null>(null);
  const [allRuns, setAllRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtering and sorting state for suite summary
  const [sortField, setSortField] = useState<SortField>("runAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<"summary" | "history">("summary");

  // Expanded suites (to show test cases)
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  const toggleSuiteExpanded = (suiteId: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/test-runs?summary=true&limit=100`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch test data");
          return;
        }

        setSummary(data.summary);
        setAllRuns(data.runs);
      } catch {
        setError("Failed to fetch test data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  const filteredAndSortedSuites = useMemo(() => {
    if (!summary) return [];

    let suites = [...summary.latestRuns];

    // Apply status filter
    if (statusFilter === "passing") {
      suites = suites.filter((s) => s.failed === 0 && s.total > 0);
    } else if (statusFilter === "failing") {
      suites = suites.filter((s) => s.failed > 0);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      suites = suites.filter(
        (s) =>
          s.suiteName.toLowerCase().includes(query) ||
          s.targetName.toLowerCase().includes(query)
      );
    }

    // Sort
    suites.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "suiteName":
          comparison = a.suiteName.localeCompare(b.suiteName);
          break;
        case "runAt":
          comparison = new Date(a.runAt).getTime() - new Date(b.runAt).getTime();
          break;
        case "passRate":
          comparison = (a.passRate ?? 0) - (b.passRate ?? 0);
          break;
        case "avgScore":
          comparison = (a.avgScore ?? 0) - (b.avgScore ?? 0);
          break;
        case "total":
          comparison = a.total - b.total;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return suites;
  }, [summary, sortField, sortDirection, statusFilter, searchQuery]);

  const getPassRateBadge = (passed: number, total: number) => {
    if (total === 0) return <Badge variant="outline">No tests</Badge>;
    const rate = (passed / total) * 100;
    const variant = rate === 100 ? "default" : rate >= 50 ? "secondary" : "destructive";
    return (
      <Badge variant={variant}>
        {passed}/{total} ({rate.toFixed(0)}%)
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading test data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalSuites === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Test Results
          </CardTitle>
          <CardDescription>No test suites in this project yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <FlaskConical className="h-12 w-12 mb-3 opacity-50" />
            <p>Create test suites to start tracking results.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{summary.totalSuites}</div>
            <div className="text-xs text-muted-foreground">Test Suites</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-green-500 flex items-center justify-center gap-1">
              {summary.suitesAllPassing}
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground">All Passing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-red-500 flex items-center justify-center gap-1">
              {summary.suitesWithFailures}
              <TrendingDown className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground">With Failures</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${summary.suitesNeverRun > 0 ? "text-yellow-500" : ""}`}>
              {summary.suitesNeverRun}
              {summary.suitesNeverRun > 0 && <AlertTriangle className="h-4 w-4" />}
            </div>
            <div className="text-xs text-muted-foreground">Never Run</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className={`text-2xl font-bold ${summary.passRate !== null && summary.passRate >= 80 ? "text-green-500" : summary.passRate !== null && summary.passRate >= 50 ? "text-yellow-500" : "text-red-500"}`}>
              {summary.passRate !== null ? `${summary.passRate}%` : "--"}
            </div>
            <div className="text-xs text-muted-foreground">Overall Pass Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              {summary.avgScore !== null ? `${summary.avgScore}%` : "--"}
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xs text-muted-foreground">Avg Judge Score</div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">
                {viewMode === "summary" ? "Latest Results by Suite" : "All Test Runs"}
              </CardTitle>
              <CardDescription>
                {viewMode === "summary"
                  ? `${summary.suitesWithRuns} suite${summary.suitesWithRuns !== 1 ? "s" : ""} with results`
                  : `${allRuns.length} total run${allRuns.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-48"
                />
              </div>
              {viewMode === "summary" && (
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suites</SelectItem>
                    <SelectItem value="passing">Passing</SelectItem>
                    <SelectItem value="failing">With Failures</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select
                value={viewMode}
                onValueChange={(v) => setViewMode(v as "summary" | "history")}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Suite Summary</SelectItem>
                  <SelectItem value="history">Run History</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "summary" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("suiteName")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Test Suite
                      <SortIcon field="suiteName" />
                    </button>
                  </TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("passRate")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Pass Rate
                      <SortIcon field="passRate" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("avgScore")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Score
                      <SortIcon field="avgScore" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("runAt")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Last Run
                      <SortIcon field="runAt" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSuites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No suites match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedSuites.map((suite) => {
                    const isExpanded = expandedSuites.has(suite.suiteId);
                    const hasTestCases = suite.testCases && suite.testCases.length > 0;

                    return (
                      <React.Fragment key={suite.suiteId}>
                        <TableRow
                          className={hasTestCases ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => hasTestCases && toggleSuiteExpanded(suite.suiteId)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasTestCases && (
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              )}
                              <FlaskConical className="h-4 w-4 text-purple-500" />
                              <span className="font-medium">{suite.suiteName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              {suite.targetType === "prompt" ? (
                                <FileText className="h-3 w-3" />
                              ) : (
                                <Globe className="h-3 w-3" />
                              )}
                              {suite.targetName}
                            </div>
                          </TableCell>
                          <TableCell>{getPassRateBadge(suite.passed, suite.total)}</TableCell>
                          <TableCell>
                            {suite.avgScore !== undefined ? (
                              <div className="flex items-center gap-1">
                                <Brain className="h-4 w-4 text-muted-foreground" />
                                {(suite.avgScore * 100).toFixed(0)}%
                              </div>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {formatDistanceToNow(new Date(suite.runAt), { addSuffix: true })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(suite.runAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link href={`/projects/${projectId}/test-suites/${suite.suiteId}`}>
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                        {hasTestCases && isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              <div className="px-4 py-3 ml-6 border-l-2 border-muted-foreground/20">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Test Cases ({suite.testCases?.length})
                                </div>
                                <div className="space-y-1">
                                  {suite.testCases?.map((tc) => (
                                    <div
                                      key={tc.testCaseId}
                                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                                    >
                                      <div className="flex items-center gap-2">
                                        {tc.passed ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className="text-sm">{tc.testCaseName}</span>
                                        {tc.error && (
                                          <span className="text-xs text-red-500 ml-2">
                                            Error: {tc.error.slice(0, 50)}{tc.error.length > 50 ? "..." : ""}
                                          </span>
                                        )}
                                        {!tc.error && tc.validationErrors.length > 0 && (
                                          <span className="text-xs text-red-500 ml-2">
                                            {tc.validationErrors[0].slice(0, 50)}{tc.validationErrors[0].length > 50 ? "..." : ""}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        {tc.judgeScore !== undefined && (
                                          <span className="flex items-center gap-1">
                                            <Brain className="h-3 w-3" />
                                            {(tc.judgeScore * 100).toFixed(0)}%
                                          </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {tc.responseTime >= 1000
                                            ? `${(tc.responseTime / 1000).toFixed(1)}s`
                                            : `${tc.responseTime}ms`}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Test Suite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No test runs yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  allRuns
                    .filter((run) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        run.suiteName.toLowerCase().includes(query) ||
                        run.targetName.toLowerCase().includes(query)
                      );
                    })
                    .map((run) => (
                      <TableRow key={run._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(run.runAt), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(run.runAt), "h:mm a")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-4 w-4 text-purple-500" />
                              <span className="font-medium">{run.suiteName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {run.targetType === "prompt" ? (
                                <FileText className="h-3 w-3" />
                              ) : (
                                <Globe className="h-3 w-3" />
                              )}
                              {run.targetName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={run.status === "completed" ? "default" : "destructive"}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {run.summary.failed === 0 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span>
                              {run.summary.passed}/{run.summary.total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {run.summary.avgScore !== undefined ? (
                            <div className="flex items-center gap-1">
                              <Brain className="h-4 w-4 text-muted-foreground" />
                              {(run.summary.avgScore * 100).toFixed(0)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {run.summary.avgResponseTime}ms
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
