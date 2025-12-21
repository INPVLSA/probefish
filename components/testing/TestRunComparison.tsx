"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  X,
  GitCompare,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    runAt: string;
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
    runAt: string;
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

interface TestRunComparisonProps {
  projectId: string;
  suiteId: string;
  runs: TestRun[];
}

export function TestRunComparison({
  projectId,
  suiteId,
  runs,
}: TestRunComparisonProps) {
  const [baselineRunId, setBaselineRunId] = useState<string>("");
  const [compareRunId, setCompareRunId] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTestCase, setSelectedTestCase] =
    useState<TestCaseComparison | null>(null);

  // Auto-select latest two runs
  useEffect(() => {
    if (runs.length >= 2) {
      setCompareRunId(runs[0]._id);
      setBaselineRunId(runs[1]._id);
    }
  }, [runs]);

  const fetchComparison = async () => {
    if (!baselineRunId || !compareRunId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}/compare?baseline=${baselineRunId}&compare=${compareRunId}`
      );
      const data = await res.json();

      if (res.ok) {
        setComparison(data);
      } else {
        toast.error(data.error || "Failed to compare runs");
      }
    } catch {
      toast.error("Failed to compare runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (baselineRunId && compareRunId && baselineRunId !== compareRunId) {
      fetchComparison();
    }
  }, [baselineRunId, compareRunId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const getStatusIcon = (status: TestCaseComparison["status"]) => {
    switch (status) {
      case "improved":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "regressed":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "new":
        return <Plus className="h-4 w-4 text-blue-500" />;
      case "removed":
        return <X className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TestCaseComparison["status"]) => {
    switch (status) {
      case "improved":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            Improved
          </Badge>
        );
      case "regressed":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            Regressed
          </Badge>
        );
      case "new":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            New
          </Badge>
        );
      case "removed":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Removed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Unchanged
          </Badge>
        );
    }
  };

  if (runs.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Need at least 2 test runs to compare.</p>
          <p className="text-sm mt-1">
            Run your tests multiple times to see comparisons.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run Selectors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Test Runs
          </CardTitle>
          <CardDescription>
            Select two runs to compare results and identify regressions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Baseline (older)</label>
              <Select value={baselineRunId} onValueChange={setBaselineRunId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select baseline run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem
                      key={run._id}
                      value={run._id}
                      disabled={run._id === compareRunId}
                    >
                      {formatDate(run.runAt)} - {run.summary.passed}/
                      {run.summary.total} passed
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground mt-6" />

            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Compare (newer)</label>
              <Select value={compareRunId} onValueChange={setCompareRunId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select run to compare" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem
                      key={run._id}
                      value={run._id}
                      disabled={run._id === baselineRunId}
                    >
                      {formatDate(run.runAt)} - {run.summary.passed}/
                      {run.summary.total} passed
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {comparison && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card
              className={cn(
                comparison.summary.regressed > 0 && "border-red-500/50"
              )}
            >
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">
                    {comparison.summary.regressed}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Regressed</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                comparison.summary.improved > 0 && "border-green-500/50"
              )}
            >
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-green-500">
                    {comparison.summary.improved}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Improved</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {comparison.summary.unchanged}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unchanged</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-blue-500">
                    {comparison.summary.new}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">New</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">
                  <span
                    className={cn(
                      comparison.summary.passRateDelta > 0 && "text-green-500",
                      comparison.summary.passRateDelta < 0 && "text-red-500"
                    )}
                  >
                    {comparison.summary.passRateDelta > 0 ? "+" : ""}
                    {comparison.summary.passRateDelta}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pass Rate Δ
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Score and Response Time Deltas */}
          {(comparison.summary.avgScoreDelta !== undefined ||
            comparison.summary.avgResponseTimeDelta !== 0) && (
            <div className="flex gap-4 text-sm">
              {comparison.summary.avgScoreDelta !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Avg Score:</span>
                  <span
                    className={cn(
                      "font-medium",
                      comparison.summary.avgScoreDelta > 0 && "text-green-500",
                      comparison.summary.avgScoreDelta < 0 && "text-red-500"
                    )}
                  >
                    {comparison.summary.avgScoreDelta > 0 ? "+" : ""}
                    {comparison.summary.avgScoreDelta}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Avg Response Time:</span>
                <span
                  className={cn(
                    "font-medium",
                    comparison.summary.avgResponseTimeDelta < 0 &&
                      "text-green-500",
                    comparison.summary.avgResponseTimeDelta > 0 && "text-red-500"
                  )}
                >
                  {comparison.summary.avgResponseTimeDelta > 0 ? "+" : ""}
                  {formatTime(comparison.summary.avgResponseTimeDelta)}
                </span>
              </div>
            </div>
          )}

          {/* Test Cases Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Test Case</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Baseline</TableHead>
                    <TableHead className="text-center">Compare</TableHead>
                    <TableHead className="text-right">Score Δ</TableHead>
                    <TableHead className="text-right">Time Δ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.testCases.map((tc) => (
                    <TableRow
                      key={tc.testCaseId}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        tc.status === "regressed" && "bg-red-500/5",
                        tc.status === "improved" && "bg-green-500/5"
                      )}
                      onClick={() => setSelectedTestCase(tc)}
                    >
                      <TableCell>{getStatusIcon(tc.status)}</TableCell>
                      <TableCell className="font-medium">
                        {tc.testCaseName}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(tc.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {tc.baseline ? (
                          tc.baseline.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {tc.compare ? (
                          tc.compare.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {tc.scoreDelta !== undefined ? (
                          <span
                            className={cn(
                              tc.scoreDelta > 0 && "text-green-500",
                              tc.scoreDelta < 0 && "text-red-500"
                            )}
                          >
                            {tc.scoreDelta > 0 ? "+" : ""}
                            {(tc.scoreDelta * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {tc.responseTimeDelta !== undefined ? (
                          <span
                            className={cn(
                              tc.responseTimeDelta < 0 && "text-green-500",
                              tc.responseTimeDelta > 0 && "text-red-500"
                            )}
                          >
                            {tc.responseTimeDelta > 0 ? "+" : ""}
                            {formatTime(tc.responseTimeDelta)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedTestCase}
        onOpenChange={() => setSelectedTestCase(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTestCase && getStatusIcon(selectedTestCase.status)}
              {selectedTestCase?.testCaseName}
              {selectedTestCase && getStatusBadge(selectedTestCase.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedTestCase && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Side by side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Baseline */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Badge variant="outline">Baseline</Badge>
                    {selectedTestCase.baseline?.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : selectedTestCase.baseline ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : null}
                  </h4>
                  {selectedTestCase.baseline ? (
                    <>
                      <div className="text-xs space-y-1">
                        {selectedTestCase.baseline.score !== undefined && (
                          <div>
                            Score:{" "}
                            <span className="font-medium">
                              {(selectedTestCase.baseline.score * 100).toFixed(
                                0
                              )}
                              %
                            </span>
                          </div>
                        )}
                        <div>
                          Time:{" "}
                          <span className="font-medium">
                            {formatTime(selectedTestCase.baseline.responseTime)}
                          </span>
                        </div>
                      </div>
                      {selectedTestCase.baseline.validationErrors.length >
                        0 && (
                        <div className="space-y-1">
                          {selectedTestCase.baseline.validationErrors.map(
                            (err, i) => (
                              <div
                                key={i}
                                className="text-xs text-red-500 flex items-start gap-1"
                              >
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {err}
                              </div>
                            )
                          )}
                        </div>
                      )}
                      <div className="bg-muted rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {selectedTestCase.baseline.output || (
                          <span className="text-muted-foreground italic">
                            No output
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Test case not in baseline run
                    </p>
                  )}
                </div>

                {/* Compare */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Badge variant="outline">Compare</Badge>
                    {selectedTestCase.compare?.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : selectedTestCase.compare ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : null}
                  </h4>
                  {selectedTestCase.compare ? (
                    <>
                      <div className="text-xs space-y-1">
                        {selectedTestCase.compare.score !== undefined && (
                          <div>
                            Score:{" "}
                            <span className="font-medium">
                              {(selectedTestCase.compare.score * 100).toFixed(
                                0
                              )}
                              %
                            </span>
                            {selectedTestCase.scoreDelta !== undefined && (
                              <span
                                className={cn(
                                  "ml-2",
                                  selectedTestCase.scoreDelta > 0 &&
                                    "text-green-500",
                                  selectedTestCase.scoreDelta < 0 &&
                                    "text-red-500"
                                )}
                              >
                                ({selectedTestCase.scoreDelta > 0 ? "+" : ""}
                                {(selectedTestCase.scoreDelta * 100).toFixed(0)}
                                %)
                              </span>
                            )}
                          </div>
                        )}
                        <div>
                          Time:{" "}
                          <span className="font-medium">
                            {formatTime(selectedTestCase.compare.responseTime)}
                          </span>
                          {selectedTestCase.responseTimeDelta !== undefined && (
                            <span
                              className={cn(
                                "ml-2",
                                selectedTestCase.responseTimeDelta < 0 &&
                                  "text-green-500",
                                selectedTestCase.responseTimeDelta > 0 &&
                                  "text-red-500"
                              )}
                            >
                              (
                              {selectedTestCase.responseTimeDelta > 0
                                ? "+"
                                : ""}
                              {formatTime(selectedTestCase.responseTimeDelta)})
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedTestCase.compare.validationErrors.length > 0 && (
                        <div className="space-y-1">
                          {selectedTestCase.compare.validationErrors.map(
                            (err, i) => (
                              <div
                                key={i}
                                className="text-xs text-red-500 flex items-start gap-1"
                              >
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {err}
                              </div>
                            )
                          )}
                        </div>
                      )}
                      <div className="bg-muted rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {selectedTestCase.compare.output || (
                          <span className="text-muted-foreground italic">
                            No output
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Test case removed in compare run
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
