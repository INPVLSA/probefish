"use client";

import { useState, Fragment } from "react";
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
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Layers,
  AlertCircle,
  Brain,
  Zap,
} from "lucide-react";
import { OpenAILogo } from "@/components/ui/openai-logo";
import { AnthropicLogo } from "@/components/ui/anthropic-logo";
import { GeminiLogo } from "@/components/ui/gemini-logo";
import { GrokLogo } from "@/components/ui/grok-logo";
import { DeepSeekLogo } from "@/components/ui/deepseek-logo";
import { getModelLabel } from "@/lib/llm/types";
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

  // Get provider icon
  const ProviderIcon = ({ provider, size = 14 }: { provider: string; size?: number }) => {
    switch (provider) {
      case "openai":
        return <OpenAILogo size={size} />;
      case "anthropic":
        return <AnthropicLogo size={size} />;
      case "gemini":
        return <GeminiLogo size={size} />;
      case "grok":
        return <GrokLogo size={size} />;
      case "deepseek":
        return <DeepSeekLogo size={size} />;
      default:
        return null;
    }
  };

  // Get short model name
  const getShortModelName = (model: string) => {
    const label = getModelLabel(model);
    const match = label.match(/^(.+?)\s*\([^)]+\)$/);
    return match ? match[1] : label;
  };

  // Calculate chart data
  const chartData = successfulResults.map((r) => ({
    model: r.model.model,
    provider: r.model.provider,
    shortName: getShortModelName(r.model.model),
    avgResponseTime: r.testRun?.summary.avgResponseTime || 0,
    avgScore: r.testRun?.summary.avgScore,
    passRate: r.testRun?.summary ? (r.testRun.summary.passed / r.testRun.summary.total) * 100 : 0,
  }));

  const maxResponseTime = Math.max(...chartData.map((d) => d.avgResponseTime));
  const hasScores = chartData.some((d) => d.avgScore !== undefined);

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
      <CardContent className="space-y-6">
        {/* Performance Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Response Time Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-amber-500" />
              Response Time
              <span className="text-xs text-muted-foreground font-normal">(lower is better)</span>
            </div>
            <div className="space-y-2">
              {chartData.map((data, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                    <ProviderIcon provider={data.provider} size={14} />
                    <span className="text-xs truncate" title={data.model}>
                      {data.shortName}
                    </span>
                  </div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(data.avgResponseTime / maxResponseTime) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white drop-shadow">
                        {(data.avgResponseTime / 1000).toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score/Pass Rate Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-blue-500" />
              {hasScores ? "Judge Score" : "Pass Rate"}
              <span className="text-xs text-muted-foreground font-normal">(higher is better)</span>
            </div>
            <div className="space-y-2">
              {chartData.map((data, idx) => {
                const value = hasScores && data.avgScore !== undefined
                  ? data.avgScore * 100
                  : data.passRate;
                const displayValue = hasScores && data.avgScore !== undefined
                  ? `${Math.round(data.avgScore * 100)}%`
                  : `${Math.round(data.passRate)}%`;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                      <ProviderIcon provider={data.provider} size={14} />
                      <span className="text-xs truncate" title={data.model}>
                        {data.shortName}
                      </span>
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                          value >= 80
                            ? "bg-gradient-to-r from-green-400 to-green-500"
                            : value >= 50
                            ? "bg-gradient-to-r from-amber-400 to-amber-500"
                            : "bg-gradient-to-r from-red-400 to-red-500"
                        }`}
                        style={{ width: `${Math.max(value, 5)}%` }}
                      >
                        <span className="text-xs font-medium text-white drop-shadow">
                          {displayValue}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error badges for failed models */}
        {results.results.some((r) => r.error) && (
          <div className="flex flex-wrap gap-2">
            {results.results
              .filter((r) => r.error)
              .map((result, idx) => (
                <Badge key={idx} variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {result.model.model}: {result.error}
                </Badge>
              ))}
          </div>
        )}

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
                  <Fragment key={testCaseName}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(testCaseName)}
                    >
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
                    {isExpanded && (
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
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
