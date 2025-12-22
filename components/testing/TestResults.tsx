"use client";

import { useRef, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ChevronRight,
  Brain,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { WindIcon, WindIconHandle } from "@/components/ui/wind";

const INPUT_COLLAPSE_THRESHOLD = 150; // Characters before collapsing

function CollapsibleText({ value, threshold = INPUT_COLLAPSE_THRESHOLD }: { value: string; threshold?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!value || value.length <= threshold) {
    return <span className="font-mono whitespace-pre-wrap break-words">{value || "(empty)"}</span>;
  }

  return (
    <span className="font-mono">
      <span className="whitespace-pre-wrap break-words">
        {isExpanded ? value : `${value.slice(0, threshold)}...`}
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 ml-1 text-xs text-primary"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        {isExpanded ? (
          <>
            <ChevronDown className="h-3 w-3 mr-0.5" />
            Show less
          </>
        ) : (
          <>
            <ChevronRight className="h-3 w-3 mr-0.5" />
            Show more ({value.length} chars)
          </>
        )}
      </Button>
    </span>
  );
}

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
  iteration?: number;
}

interface TestRun {
  _id: string;
  runAt: string;
  status: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

interface TestResultsProps {
  testRun: TestRun | null;
}

function EmptyResults() {
  const windRef = useRef<WindIconHandle>(null);

  useEffect(() => {
    // Animate wind on mount
    const timer = setTimeout(() => {
      windRef.current?.startAnimation();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Results</CardTitle>
        <CardDescription>Run tests to see results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <WindIcon ref={windRef} size={32} className="mb-3" />
          <p>No test results yet.</p>
          <p className="text-sm">Click &quot;Run All Tests&quot; to execute tests.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestResults({ testRun }: TestResultsProps) {
  if (!testRun) {
    return <EmptyResults />;
  }

  const { summary, results, runAt } = testRun;
  const passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Test Results</CardTitle>
            <CardDescription>
              {formatDistanceToNow(new Date(runAt), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge
            variant={passRate === 100 ? "default" : passRate > 50 ? "secondary" : "destructive"}
          >
            {summary.passed}/{summary.total} passed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">
              {summary.passed}
            </div>
            <div className="text-xs text-muted-foreground">Passed</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-500">
              {summary.failed}
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          {summary.avgScore !== undefined && (
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {(summary.avgScore * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Score</div>
            </div>
          )}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {summary.avgResponseTime >= 1000
                ? `${(summary.avgResponseTime / 1000).toFixed(1)}s`
                : `${summary.avgResponseTime}ms`}
            </div>
            <div className="text-xs text-muted-foreground">Avg Time</div>
          </div>
        </div>

        {/* Individual Results */}
        <div className="space-y-2">
          {results.map((result, index) => (
            <TestResultItem key={`${result.testCaseId}-${result.iteration || 0}-${index}`} result={result} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TestResultItem({ result }: { result: TestResult }) {
  const passed = result.validationPassed && !result.error;

  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          {passed ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          )}
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium truncate">{result.testCaseName}</div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.responseTime}ms
              </span>
              {result.judgeScore !== undefined && (
                <span className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {(result.judgeScore * 100).toFixed(0)}%
                </span>
              )}
              {result.error && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  Error
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 py-3 space-y-3 border-l-2 border-muted ml-2.5 mt-1">
          {/* Input */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Input
            </div>
            <div className="bg-muted rounded p-2 text-sm space-y-1">
              {Object.entries(result.inputs).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key}:</span>{" "}
                  <CollapsibleText value={value} />
                </div>
              ))}
            </div>
          </div>

          {/* Output */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Output
            </div>
            <div className="bg-muted rounded p-2 text-sm max-h-40 overflow-auto">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {result.output || "(empty)"}
              </pre>
            </div>
          </div>

          {/* Error */}
          {result.error && (
            <div>
              <div className="text-xs font-medium text-red-500 mb-1">Error</div>
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-sm text-red-500">
                {result.error}
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {result.validationErrors.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-500 mb-1">
                Validation Errors
              </div>
              <div className="space-y-1">
                {result.validationErrors.map((error, i) => (
                  <div
                    key={i}
                    className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-sm text-red-500"
                  >
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Judge Scores */}
          {result.judgeScores && Object.keys(result.judgeScores).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Judge Scores
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.judgeScores).map(([criterion, score]) => (
                  <Badge key={criterion} variant="outline">
                    {criterion}: {score}/10
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Judge Reasoning */}
          {result.judgeReasoning && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Judge Reasoning
              </div>
              <div className="bg-muted rounded p-2 text-sm">
                {result.judgeReasoning}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
