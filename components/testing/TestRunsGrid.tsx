"use client";

import { useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Eye,
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
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const handleViewDetails = (run: TestRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
    onSelectRun?.(run);
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRuns.map((run) => (
                <TableRow key={run._id} className="cursor-pointer">
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(run)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAndSortedRuns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No runs match the current filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Test Run Details
              {selectedRun && getStatusBadge(selectedRun.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedRun &&
                `${formatDistanceToNow(new Date(selectedRun.runAt), {
                  addSuffix: true,
                })} - ${format(new Date(selectedRun.runAt), "PPpp")}`}
            </DialogDescription>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {selectedRun.summary.passed}
                  </div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {selectedRun.summary.failed}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                {selectedRun.summary.avgScore !== undefined && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {(selectedRun.summary.avgScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Score</div>
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {selectedRun.summary.avgResponseTime}ms
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Time</div>
                </div>
              </div>

              {/* Results Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Test Case</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRun.results.map((result, index) => {
                    const passed = result.validationPassed && !result.error;
                    return (
                      <TableRow key={result.testCaseId || index}>
                        <TableCell>
                          {passed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {result.testCaseName}
                        </TableCell>
                        <TableCell>
                          {result.judgeScore !== undefined ? (
                            <span>{(result.judgeScore * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>{result.responseTime}ms</TableCell>
                        <TableCell>
                          {result.error ? (
                            <div className="flex items-center gap-1 text-red-500 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              Error
                            </div>
                          ) : result.validationErrors.length > 0 ? (
                            <Badge variant="destructive">
                              {result.validationErrors.length} error
                              {result.validationErrors.length !== 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
