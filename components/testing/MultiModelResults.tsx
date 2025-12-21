"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Layers,
  AlertCircle,
} from "lucide-react";
import { MultiModelRunResult } from "./TestRunner";

interface MultiModelResultsProps {
  results: MultiModelRunResult | null;
}

export function MultiModelResults({ results }: MultiModelResultsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!results || results.results.length === 0) {
    return null;
  }

  const successfulResults = results.results.filter((r) => r.testRun);

  // Get all unique test case names from all runs
  const testCaseNames = new Set<string>();
  successfulResults.forEach((r) => {
    r.testRun?.results.forEach((tr) => {
      testCaseNames.add(tr.testCaseName);
    });
  });
  const testCases = Array.from(testCaseNames);

  const toggleRow = (testCaseName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(testCaseName)) {
        next.delete(testCaseName);
      } else {
        next.add(testCaseName);
      }
      return next;
    });
  };

  // Get result for a specific model and test case
  const getTestResult = (modelIdx: number, testCaseName: string) => {
    const result = results.results[modelIdx];
    if (!result.testRun) return null;
    return result.testRun.results.find((r) => r.testCaseName === testCaseName);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Multi-Model Comparison
        </CardTitle>
        <CardDescription>
          {successfulResults.length} model{successfulResults.length !== 1 ? "s" : ""} × {testCases.length} test{testCases.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {results.results.map((result, idx) => {
            const summary = result.testRun?.summary;
            const passRate = summary
              ? Math.round((summary.passed / summary.total) * 100)
              : 0;

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  result.error
                    ? "bg-destructive/10 border-destructive/20"
                    : passRate === 100
                    ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
                }`}
              >
                <div className="font-mono text-xs truncate" title={result.model.model}>
                  {result.model.model}
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {result.model.provider}
                </div>
                {result.error ? (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${passRate === 100 ? "text-green-600" : "text-amber-600"}`}>
                      {passRate}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {summary?.passed}/{summary?.total}
                    </span>
                  </div>
                )}
                {summary?.avgResponseTime && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {(summary.avgResponseTime / 1000).toFixed(1)}s avg
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison Grid */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Test Case</TableHead>
                {results.results.map((result, idx) => (
                  <TableHead key={idx} className="text-center min-w-[120px]">
                    <div className="font-mono text-xs truncate" title={result.model.model}>
                      {result.model.model.split("-").slice(-2).join("-")}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCaseName) => {
                const isExpanded = expandedRows.has(testCaseName);

                return (
                  <Collapsible key={testCaseName} open={isExpanded} onOpenChange={() => toggleRow(testCaseName)}>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                              <span className="truncate" title={testCaseName}>
                                {testCaseName}
                              </span>
                            </div>
                          </TableCell>
                          {results.results.map((_, modelIdx) => {
                            const testResult = getTestResult(modelIdx, testCaseName);
                            if (!testResult) {
                              return (
                                <TableCell key={modelIdx} className="text-center">
                                  <span className="text-muted-foreground">-</span>
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={modelIdx} className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {testResult.validationPassed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  {testResult.judgeScore !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(testResult.judgeScore * 100)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                          <TableCell colSpan={results.results.length + 1} className="p-0">
                            <div className="grid gap-2 p-3" style={{ gridTemplateColumns: `repeat(${results.results.length}, 1fr)` }}>
                              {results.results.map((_, modelIdx) => {
                                const testResult = getTestResult(modelIdx, testCaseName);
                                const modelName = results.results[modelIdx].model.model;

                                if (!testResult) {
                                  return (
                                    <div key={modelIdx} className="p-2 rounded border bg-muted/50 text-sm text-muted-foreground">
                                      No result
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={modelIdx}
                                    className={`p-2 rounded border ${
                                      testResult.validationPassed
                                        ? "bg-green-50/50 border-green-200 dark:bg-green-900/5 dark:border-green-800"
                                        : "bg-red-50/50 border-red-200 dark:bg-red-900/5 dark:border-red-800"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-mono text-xs text-muted-foreground truncate">
                                        {modelName.split("-").slice(-2).join("-")}
                                      </span>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {(testResult.responseTime / 1000).toFixed(1)}s
                                      </div>
                                    </div>
                                    <div className="text-sm line-clamp-4 whitespace-pre-wrap">
                                      {testResult.output}
                                    </div>
                                    {testResult.validationErrors.length > 0 && (
                                      <div className="mt-1 text-xs text-red-600">
                                        {testResult.validationErrors.join(", ")}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
