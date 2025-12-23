"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
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
  Eye,
} from "lucide-react";
import { OpenAILogo } from "@/components/ui/openai-logo";
import { AnthropicLogo } from "@/components/ui/anthropic-logo";
import { GeminiLogo } from "@/components/ui/gemini-logo";
import { GrokLogo } from "@/components/ui/grok-logo";
import { DeepSeekLogo } from "@/components/ui/deepseek-logo";
import { getModelLabel } from "@/lib/llm/types";

interface ModelSelection {
  provider: "openai" | "anthropic" | "gemini" | "grok" | "deepseek";
  model: string;
  isPrimary?: boolean;
}

interface TestResult {
  testCaseId: string;
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  responseTime: number;
  error?: string;
}

interface TestRun {
  _id: string;
  runAt: string;
  status: string;
  modelOverride?: {
    provider: string;
    model: string;
  };
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

interface ComparisonSession {
  _id: string;
  runAt: string;
  models: ModelSelection[];
  runs: TestRun[];
}

interface ComparisonSessionsViewerProps {
  projectId: string;
  suiteId: string;
  onSelectSession?: (session: ComparisonSession) => void;
}

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

export function ComparisonSessionsViewer({
  projectId,
  suiteId,
  onSelectSession,
}: ComparisonSessionsViewerProps) {
  const [sessions, setSessions] = useState<ComparisonSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/comparison-sessions`
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error("Failed to fetch comparison sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [projectId, suiteId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading comparison sessions...
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Comparison Sessions
          </CardTitle>
          <CardDescription>No comparison sessions yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Layers className="h-8 w-8 mb-3 opacity-50" />
            <p>Run tests on multiple models to create comparison sessions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Comparison Sessions
        </CardTitle>
        <CardDescription>
          {sessions.length} saved comparison{sessions.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session) => {
          const isExpanded = expandedSession === session._id;
          const testCaseNames = new Set<string>();
          session.runs.forEach((run) => {
            run.results.forEach((r) => testCaseNames.add(r.testCaseName));
          });

          return (
            <Collapsible
              key={session._id}
              open={isExpanded}
              onOpenChange={() =>
                setExpandedSession(isExpanded ? null : session._id)
              }
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                    <div>
                      <div className="font-medium text-sm">
                        {format(new Date(session.runAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.runAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {session.models.map((m, idx) => (
                        <span key={idx} title={m.model}>
                          <ProviderIcon provider={m.provider} size={16} />
                        </span>
                      ))}
                    </div>
                    <Badge variant="outline">
                      {session.models.length} models × {testCaseNames.size} tests
                    </Badge>
                    {onSelectSession && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSession(session);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Test Case</TableHead>
                        {session.runs.map((run, idx) => (
                          <TableHead key={idx} className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-1">
                              <ProviderIcon
                                provider={run.modelOverride?.provider || "openai"}
                                size={14}
                              />
                              <span className="text-xs font-mono truncate max-w-[80px]">
                                {(() => {
                                  const label = getModelLabel(run.modelOverride?.model || "");
                                  const match = label.match(/^(.+?)\s*\([^)]+\)$/);
                                  return match ? match[1] : label;
                                })()}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(testCaseNames).map((testCaseName) => (
                        <TableRow key={testCaseName}>
                          <TableCell className="font-medium text-sm">
                            {testCaseName}
                          </TableCell>
                          {session.runs.map((run, idx) => {
                            const result = run.results.find(
                              (r) => r.testCaseName === testCaseName
                            );
                            if (!result) {
                              return (
                                <TableCell key={idx} className="text-center">
                                  <span className="text-muted-foreground">-</span>
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={idx} className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {result.validationPassed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  {result.judgeScore !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(result.judgeScore * 100)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* Summary row */}
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-sm">Summary</TableCell>
                        {session.runs.map((run, idx) => (
                          <TableCell key={idx} className="text-center">
                            <div className="text-xs space-y-1">
                              <div
                                className={
                                  run.summary.passed === run.summary.total
                                    ? "text-green-600 font-medium"
                                    : run.summary.failed > 0
                                    ? "text-red-600 font-medium"
                                    : ""
                                }
                              >
                                {run.summary.passed}/{run.summary.total}
                              </div>
                              {run.summary.avgScore !== undefined && (
                                <div className="text-muted-foreground">
                                  {Math.round(run.summary.avgScore * 100)}%
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {(run.summary.avgResponseTime / 1000).toFixed(1)}s
                              </div>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
