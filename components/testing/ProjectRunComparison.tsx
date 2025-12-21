"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calendar,
  FlaskConical,
  FileText,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

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
    runAt: string;
    passed: number;
    failed: number;
    total: number;
    avgScore?: number;
  } | null;
  compare: {
    runId: string;
    runAt: string;
    passed: number;
    failed: number;
    total: number;
    avgScore?: number;
  } | null;
  status: "improved" | "regressed" | "unchanged" | "new" | "removed" | "not-run";
  passRateDelta?: number;
  testCases: TestCaseComparison[];
}

interface ComparisonResult {
  baselineDate: string;
  compareDate: string;
  summary: {
    totalSuites: number;
    suitesCompared: number;
    suitesImproved: number;
    suitesRegressed: number;
    suitesUnchanged: number;
    totalTestCases: number;
    improved: number;
    regressed: number;
    unchanged: number;
    new: number;
    removed: number;
  };
  suites: SuiteComparison[];
}

interface ProjectRunComparisonProps {
  projectId: string;
}

export function ProjectRunComparison({ projectId }: ProjectRunComparisonProps) {
  const [baselineDate, setBaselineDate] = useState(() =>
    format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [compareDate, setCompareDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [selectedTestCase, setSelectedTestCase] =
    useState<TestCaseComparison | null>(null);

  const fetchComparison = async () => {
    if (!baselineDate || !compareDate) return;

    setLoading(true);
    try {
      const baselineISO = new Date(baselineDate + "T23:59:59").toISOString();
      const compareISO = new Date(compareDate + "T23:59:59").toISOString();

      const res = await fetch(
        `/api/projects/${projectId}/compare?baselineDate=${baselineISO}&compareDate=${compareISO}`
      );
      const data = await res.json();

      if (res.ok) {
        setComparison(data);
        // Auto-expand suites with regressions
        const regressedSuites = data.suites
          .filter((s: SuiteComparison) => s.status === "regressed")
          .map((s: SuiteComparison) => s.suiteId);
        setExpandedSuites(new Set(regressedSuites));
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
    fetchComparison();
  }, []);

  const handleCompare = () => {
    fetchComparison();
  };

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

  const formatTime = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "improved":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "regressed":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "new":
        return <Plus className="h-4 w-4 text-blue-500" />;
      case "removed":
        return <X className="h-4 w-4 text-muted-foreground" />;
      case "not-run":
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
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
      case "not-run":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not Run
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

  return (
    <div className="space-y-4">
      {/* Date Selectors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Test Runs Across All Suites
          </CardTitle>
          <CardDescription>
            Compare the latest test results before each date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full space-y-1">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Baseline Date
              </Label>
              <Input
                type="date"
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
                className="w-full"
              />
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block mb-2" />

            <div className="flex-1 w-full space-y-1">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Compare Date
              </Label>
              <Input
                type="date"
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                className="w-full"
              />
            </div>

            <Button onClick={handleCompare} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <GitCompare className="h-4 w-4 mr-2" />
              )}
              Compare
            </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {comparison.summary.suitesCompared}
                </div>
                <p className="text-xs text-muted-foreground">Suites Compared</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                comparison.summary.regressed > 0 && "border-red-500/50"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">
                    {comparison.summary.regressed}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Tests Regressed</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                comparison.summary.improved > 0 && "border-green-500/50"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-green-500">
                    {comparison.summary.improved}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Tests Improved</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {comparison.summary.unchanged}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Unchanged</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-blue-500">
                    {comparison.summary.new}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">New Tests</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {comparison.summary.suitesRegressed > 0 ? (
                    <span className="text-red-500">
                      {comparison.summary.suitesRegressed}
                    </span>
                  ) : (
                    <span className="text-green-500">0</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Suites with Regressions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Suites Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Test Suite</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Baseline</TableHead>
                    <TableHead className="text-center">Compare</TableHead>
                    <TableHead className="text-right">Pass Rate Δ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.suites.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No test suites found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.suites.map((suite) => {
                      const isExpanded = expandedSuites.has(suite.suiteId);
                      const hasTestCases = suite.testCases.length > 0;

                      return (
                        <React.Fragment key={suite.suiteId}>
                          <TableRow
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              suite.status === "regressed" && "bg-red-500/5",
                              suite.status === "improved" && "bg-green-500/5"
                            )}
                            onClick={() =>
                              hasTestCases && toggleSuiteExpanded(suite.suiteId)
                            }
                          >
                            <TableCell>
                              {hasTestCases ? (
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                              ) : (
                                getStatusIcon(suite.status)
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-purple-500" />
                                <span className="font-medium">
                                  {suite.suiteName}
                                </span>
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
                            <TableCell className="text-center">
                              {getStatusBadge(suite.status)}
                            </TableCell>
                            <TableCell className="text-center">
                              {suite.baseline ? (
                                <span className="text-sm">
                                  {suite.baseline.passed}/{suite.baseline.total}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {suite.compare ? (
                                <span className="text-sm">
                                  {suite.compare.passed}/{suite.compare.total}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {suite.passRateDelta !== undefined ? (
                                <span
                                  className={cn(
                                    "font-medium",
                                    suite.passRateDelta > 0 && "text-green-500",
                                    suite.passRateDelta < 0 && "text-red-500"
                                  )}
                                >
                                  {suite.passRateDelta > 0 ? "+" : ""}
                                  {suite.passRateDelta}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link
                                  href={`/projects/${projectId}/test-suites/${suite.suiteId}?tab=compare`}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Expanded test cases */}
                          {hasTestCases && isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="px-4 py-3 ml-6 border-l-2 border-muted-foreground/20">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Test Cases ({suite.testCases.length})
                                  </div>
                                  <div className="space-y-1">
                                    {suite.testCases.map((tc) => (
                                      <div
                                        key={tc.testCaseId}
                                        className={cn(
                                          "flex items-center justify-between py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50",
                                          tc.status === "regressed" &&
                                            "bg-red-500/10",
                                          tc.status === "improved" &&
                                            "bg-green-500/10"
                                        )}
                                        onClick={() => setSelectedTestCase(tc)}
                                      >
                                        <div className="flex items-center gap-2">
                                          {getStatusIcon(tc.status)}
                                          <span className="text-sm">
                                            {tc.testCaseName}
                                          </span>
                                          {getStatusBadge(tc.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                          {tc.scoreDelta !== undefined && (
                                            <span
                                              className={cn(
                                                tc.scoreDelta > 0 &&
                                                  "text-green-500",
                                                tc.scoreDelta < 0 &&
                                                  "text-red-500"
                                              )}
                                            >
                                              {tc.scoreDelta > 0 ? "+" : ""}
                                              {(tc.scoreDelta * 100).toFixed(0)}
                                              %
                                            </span>
                                          )}
                                          {tc.responseTimeDelta !==
                                            undefined && (
                                            <span
                                              className={cn(
                                                tc.responseTimeDelta < 0 &&
                                                  "text-green-500",
                                                tc.responseTimeDelta > 0 &&
                                                  "text-red-500"
                                              )}
                                            >
                                              {tc.responseTimeDelta > 0
                                                ? "+"
                                                : ""}
                                              {formatTime(tc.responseTimeDelta)}
                                            </span>
                                          )}
                                          <ChevronRight className="h-4 w-4" />
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
              <span>{selectedTestCase?.testCaseName}</span>
              {selectedTestCase && getStatusBadge(selectedTestCase.status)}
            </DialogTitle>
            {selectedTestCase && (
              <p className="text-sm text-muted-foreground">
                Suite: {selectedTestCase.suiteName}
              </p>
            )}
          </DialogHeader>
          {selectedTestCase && (
            <div className="flex-1 overflow-y-auto space-y-4">
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
                      No baseline run
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
                      No compare run
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
