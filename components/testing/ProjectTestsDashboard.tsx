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
import { Skeleton } from "@/components/ui/skeleton";
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
  GitCompare,
  History,
} from "lucide-react";
import { ProjectRunComparison } from "./ProjectRunComparison";

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
type StatusFilter = "all" | "passing" | "failing";

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

  // Compare mode
  const [showCompare, setShowCompare] = useState(false);

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
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
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

  const filteredRuns = useMemo(() => {
    if (!searchQuery) return allRuns.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return allRuns
      .filter(
        (run) =>
          run.suiteName.toLowerCase().includes(query) ||
          run.targetName.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [allRuns, searchQuery]);

  const getPassRateBadge = (passed: number, total: number) => {
    if (total === 0) return <Badge variant="outline">No tests</Badge>;
    const rate = (passed / total) * 100;
    const variant = rate === 100 ? "default" : rate >= 50 ? "secondary" : "destructive";
    return (
      <Badge variant={variant} className="text-xs">
        {passed}/{total}
      </Badge>
    );
  };

  if (loading) {
    return (
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

  if (showCompare) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Compare Test Runs</h3>
          <Button variant="outline" size="sm" onClick={() => setShowCompare(false)}>
            Back to Dashboard
          </Button>
        </div>
        <ProjectRunComparison projectId={projectId} />
      </div>
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
            <div className="text-xs text-muted-foreground">Pass Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              {summary.avgScore !== null ? `${summary.avgScore}%` : "--"}
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suites</SelectItem>
            <SelectItem value="passing">Passing</SelectItem>
            <SelectItem value="failing">Failing</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setShowCompare(true)}>
          <GitCompare className="h-4 w-4 mr-2" />
          Compare Runs
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Suite Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Test Suites
            </CardTitle>
            <CardDescription>
              {summary.suitesWithRuns} of {summary.totalSuites} suites have results
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("suiteName")}
                      className="flex items-center hover:text-foreground transition-colors text-xs"
                    >
                      Suite
                      <SortIcon field="suiteName" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("passRate")}
                      className="flex items-center hover:text-foreground transition-colors text-xs"
                    >
                      Result
                      <SortIcon field="passRate" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("runAt")}
                      className="flex items-center hover:text-foreground transition-colors text-xs"
                    >
                      Last Run
                      <SortIcon field="runAt" />
                    </button>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSuites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                      No suites match filters
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
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1.5">
                              {hasTestCases && (
                                <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate max-w-[140px]">
                                  {suite.suiteName}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {suite.targetType === "prompt" ? (
                                    <FileText className="h-3 w-3 flex-shrink-0" />
                                  ) : (
                                    <Globe className="h-3 w-3 flex-shrink-0" />
                                  )}
                                  <span className="truncate max-w-[100px]">{suite.targetName}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            {getPassRateBadge(suite.passed, suite.total)}
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(suite.runAt), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link href={`/projects/${projectId}/test-suites/${suite.suiteId}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                        {hasTestCases && isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={4} className="p-0">
                              <div className="px-3 py-2 ml-4 border-l-2 border-muted-foreground/20">
                                <div className="space-y-1">
                                  {suite.testCases?.map((tc) => (
                                    <div
                                      key={tc.testCaseId}
                                      className="flex items-center justify-between py-1 text-xs"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {tc.passed ? (
                                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <XCircle className="h-3 w-3 text-red-500" />
                                        )}
                                        <span className="truncate max-w-[150px]">{tc.testCaseName}</span>
                                      </div>
                                      {tc.judgeScore !== undefined && (
                                        <span className="text-muted-foreground">
                                          {(tc.judgeScore * 100).toFixed(0)}%
                                        </span>
                                      )}
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
          </CardContent>
        </Card>

        {/* Right: Recent Runs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Runs
            </CardTitle>
            <CardDescription>
              {allRuns.length} total runs across all suites
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">When</TableHead>
                  <TableHead className="text-xs">Suite</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                      No runs yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRuns.map((run) => (
                    <TableRow key={run._id}>
                      <TableCell className="py-2">
                        <div className="text-xs">
                          <div className="font-medium">
                            {format(new Date(run.runAt), "MMM d")}
                          </div>
                          <div className="text-muted-foreground">
                            {format(new Date(run.runAt), "h:mm a")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate max-w-[120px]">
                            {run.suiteName}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {run.targetType === "prompt" ? (
                              <FileText className="h-3 w-3 flex-shrink-0" />
                            ) : (
                              <Globe className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="truncate max-w-[80px]">{run.targetName}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          {run.summary.failed === 0 ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="text-xs">
                            {run.summary.passed}/{run.summary.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {run.summary.avgResponseTime >= 1000
                            ? `${(run.summary.avgResponseTime / 1000).toFixed(1)}s`
                            : `${run.summary.avgResponseTime}ms`}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {allRuns.length > 10 && (
              <div className="px-4 py-2 border-t text-center">
                <span className="text-xs text-muted-foreground">
                  Showing 10 of {allRuns.length} runs
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
