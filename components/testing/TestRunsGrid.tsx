"use client";

import { useState, useMemo, Fragment } from "react";
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
  ChevronUp,
  ChevronDown,
  Search,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";

interface TestResult {
  testCaseId: string;
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  extractedContent?: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  judgeScores?: Record<string, number>;
  judgeReasoning?: string;
  responseTime: number;
  error?: string;
}

interface TestRun {
  _id: string;
  runAt: string;
  status: "running" | "completed" | "failed";
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

interface TestRunsGridProps {
  runs: TestRun[];
  onSelectRun?: (run: TestRun) => void;
}

type SortField = "runAt" | "passRate" | "avgScore" | "avgResponseTime" | "total";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "completed" | "failed" | "running";

export function TestRunsGrid({ runs, onSelectRun }: TestRunsGridProps) {
  const [sortField, setSortField] = useState<SortField>("runAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleResultExpand = (resultKey: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(resultKey)) {
        next.delete(resultKey);
      } else {
        next.add(resultKey);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedRuns = useMemo(() => {
    let filtered = [...runs];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((run) => run.status === statusFilter);
    }

    // Apply search (searches in run date or results)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((run) => {
        const dateStr = format(new Date(run.runAt), "PPpp").toLowerCase();
        return (
          dateStr.includes(query) ||
          run.results.some((r) => r.testCaseName.toLowerCase().includes(query))
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
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
        case "total":
          comparison = a.summary.total - b.summary.total;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [runs, sortField, sortDirection, statusFilter, searchQuery]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            Failed
          </Badge>
        );
      case "running":
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPassRateBadge = (summary: TestRun["summary"]) => {
    const rate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;
    const badgeClass = rate === 100
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : rate >= 70
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : rate >= 50
      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      : "bg-red-500/10 text-red-600 border-red-500/20";
    return (
      <Badge className={badgeClass}>
        {summary.passed}/{summary.total} ({rate.toFixed(0)}%)
      </Badge>
    );
  };

  const toggleExpand = (run: TestRun) => {
    const isExpanding = expandedRun !== run._id;
    setExpandedRun(isExpanding ? run._id : null);
    if (isExpanding) {
      onSelectRun?.(run);
    }
  };

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run History</CardTitle>
          <CardDescription>No test runs yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mb-3" />
            <p>No test runs recorded.</p>
            <p className="text-sm">Run tests to see history here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Run History</CardTitle>
              <CardDescription>
                {runs.length} test run{runs.length !== 1 ? "s" : ""} recorded
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search runs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-48"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("runAt")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Date
                    <SortIcon field="runAt" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
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
                    Avg Score
                    <SortIcon field="avgScore" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("avgResponseTime")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Avg Time
                    <SortIcon field="avgResponseTime" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("total")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Tests
                    <SortIcon field="total" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRuns.map((run) => {
                const isExpanded = expandedRun === run._id;
                return (
                  <Fragment key={run._id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(run)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform flex-shrink-0 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(run.runAt), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(run.runAt), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell>{getPassRateBadge(run.summary)}</TableCell>
                      <TableCell>
                        {run.summary.avgScore !== undefined ? (
                          <div className="flex items-center gap-1">
                            <Brain className={`h-4 w-4 ${
                              run.summary.avgScore >= 0.8 ? "text-green-500" :
                              run.summary.avgScore >= 0.6 ? "text-yellow-500" :
                              "text-red-500"
                            }`} />
                            <span className={`font-medium ${
                              run.summary.avgScore >= 0.8 ? "text-green-600" :
                              run.summary.avgScore >= 0.6 ? "text-yellow-600" :
                              "text-red-600"
                            }`}>
                              {(run.summary.avgScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{run.summary.avgResponseTime}ms</span>
                        </div>
                      </TableCell>
                      <TableCell>{run.summary.total}</TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 space-y-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-card rounded-lg p-3 text-center border">
                                <div className="text-2xl font-bold text-green-500">
                                  {run.summary.passed}
                                </div>
                                <div className="text-xs text-muted-foreground">Passed</div>
                              </div>
                              <div className="bg-card rounded-lg p-3 text-center border">
                                <div className="text-2xl font-bold text-red-500">
                                  {run.summary.failed}
                                </div>
                                <div className="text-xs text-muted-foreground">Failed</div>
                              </div>
                              {run.summary.avgScore !== undefined && (
                                <div className="bg-card rounded-lg p-3 text-center border">
                                  <div className="text-2xl font-bold text-primary">
                                    {(run.summary.avgScore * 100).toFixed(0)}%
                                  </div>
                                  <div className="text-xs text-muted-foreground">Avg Score</div>
                                </div>
                              )}
                              <div className="bg-card rounded-lg p-3 text-center border">
                                <div className="text-2xl font-bold">
                                  {run.summary.avgResponseTime}ms
                                </div>
                                <div className="text-xs text-muted-foreground">Avg Time</div>
                              </div>
                            </div>

                            {/* Results Table */}
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[50px]">Status</TableHead>
                                    <TableHead>Test Case</TableHead>
                                    <TableHead className="w-[80px]">Score</TableHead>
                                    <TableHead className="w-[80px]">Time</TableHead>
                                    <TableHead>Issues</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {run.results.map((result, index) => {
                                    const passed = result.validationPassed && !result.error;
                                    const resultKey = `${run._id}-${result.testCaseId || index}`;
                                    const isResultExpanded = expandedResults.has(resultKey);
                                    return (
                                      <Fragment key={result.testCaseId || index}>
                                        <TableRow
                                          className="cursor-pointer hover:bg-muted/50"
                                          onClick={() => toggleResultExpand(resultKey)}
                                        >
                                          <TableCell>
                                            <div className="flex items-center gap-1">
                                              <ChevronDown
                                                className={`h-3 w-3 transition-transform ${
                                                  isResultExpanded ? "rotate-180" : ""
                                                }`}
                                              />
                                              {passed ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                              ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {result.testCaseName}
                                          </TableCell>
                                          <TableCell>
                                            {result.judgeScore !== undefined ? (
                                              <div className="flex items-center gap-1">
                                                <Brain className={`h-4 w-4 ${
                                                  result.judgeScore >= 0.8 ? "text-green-500" :
                                                  result.judgeScore >= 0.6 ? "text-yellow-500" :
                                                  "text-red-500"
                                                }`} />
                                                <span className={`font-medium ${
                                                  result.judgeScore >= 0.8 ? "text-green-600" :
                                                  result.judgeScore >= 0.6 ? "text-yellow-600" :
                                                  "text-red-600"
                                                }`}>
                                                  {(result.judgeScore * 100).toFixed(0)}%
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground">--</span>
                                            )}
                                          </TableCell>
                                          <TableCell>{result.responseTime}ms</TableCell>
                                          <TableCell>
                                            {result.error ? (
                                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                                <AlertCircle className="h-3 w-3 mr-1" />
                                                Error
                                              </Badge>
                                            ) : result.validationErrors.length > 0 ? (
                                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                                {result.validationErrors.length} error
                                                {result.validationErrors.length !== 1 ? "s" : ""}
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                                None
                                              </Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>

                                        {isResultExpanded && (
                                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                                            <TableCell colSpan={5} className="p-4">
                                              <div className="space-y-4">
                                                {/* Inputs */}
                                                {Object.keys(result.inputs).length > 0 && (
                                                  <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Inputs</div>
                                                    <div className="bg-card border rounded p-3 space-y-2">
                                                      {Object.entries(result.inputs).map(([key, value]) => (
                                                        <div key={key} className="text-sm">
                                                          <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                                                          <span className="whitespace-pre-wrap">{value}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Output */}
                                                <div>
                                                  <div className="text-xs font-medium text-muted-foreground mb-2">Output</div>
                                                  <div className="bg-card border rounded p-3">
                                                    <pre className="text-sm whitespace-pre-wrap">{result.output || "No output"}</pre>
                                                  </div>
                                                </div>

                                                {/* Extracted Content */}
                                                {result.extractedContent && (
                                                  <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Extracted Content</div>
                                                    <div className="bg-card border rounded p-3">
                                                      <pre className="text-sm whitespace-pre-wrap">{result.extractedContent}</pre>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Judge Reasoning */}
                                                {result.judgeReasoning && (
                                                  <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Judge Reasoning</div>
                                                    <div className="bg-card border rounded p-3">
                                                      <p className="text-sm whitespace-pre-wrap">{result.judgeReasoning}</p>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Validation Errors */}
                                                {result.validationErrors.length > 0 && (
                                                  <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Validation Errors</div>
                                                    <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
                                                      <ul className="text-sm text-red-600 space-y-1">
                                                        {result.validationErrors.map((err, i) => (
                                                          <li key={i}>• {err}</li>
                                                        ))}
                                                      </ul>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Error */}
                                                {result.error && (
                                                  <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Error</div>
                                                    <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
                                                      <p className="text-sm text-red-600">{result.error}</p>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          {filteredAndSortedRuns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No runs match the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
