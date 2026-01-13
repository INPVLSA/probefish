"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Play, PlayCircle, StickyNote, Minus, Plus, ChevronDown, Settings2, Tag } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RefreshCWIcon, RefreshCCWIconWIcon } from "@/components/ui/refresh-cw";
import { AirplaneIcon, AirplaneIconHandle } from "@/components/ui/airplane";
import { ModelCardSelector, ModelSelection } from "./ModelCardSelector";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  parseSSEEvents,
  isConnectedEvent,
  isProgressEvent,
  isResultEvent,
  isCompleteEvent,
  isErrorEvent,
  ResultEvent,
} from "@/lib/utils/sseParser";

export interface TestRunResult {
  success: boolean;
  testRun?: {
    _id: string;
    status: string;
    modelOverride?: {
      provider: string;
      model: string;
    };
    results: Array<{
      testCaseId: string;
      testCaseName: string;
      inputs: Record<string, string>;
      output: string;
      validationPassed: boolean;
      validationErrors: string[];
      judgeScore?: number;
      judgeScores?: Record<string, number>;
      judgeReasoning?: string;
      judgeValidationPassed?: boolean;
      judgeValidationErrors?: string[];
      judgeValidationWarnings?: string[];
      responseTime: number;
      error?: string;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    };
  };
  error?: string;
}

export interface MultiModelRunResult {
  success: boolean;
  results: Array<{
    model: ModelSelection;
    testRun?: TestRunResult["testRun"];
    error?: string;
  }>;
}

interface TestExecutionPanelProps {
  projectId: string;
  suiteId: string;
  testCaseCount: number;
  targetType: "prompt" | "endpoint";
  availableProviders: { openai: boolean; anthropic: boolean; gemini: boolean; grok: boolean; deepseek: boolean };
  savedComparisonModels?: ModelSelection[];
  availableTags?: string[];
  selectedTestCaseIds?: string[];
  onRunComplete: (result: TestRunResult | MultiModelRunResult) => void;
}

export function TestExecutionPanel({
  projectId,
  suiteId,
  testCaseCount,
  targetType,
  availableProviders,
  savedComparisonModels,
  availableTags = [],
  selectedTestCaseIds = [],
  onRunComplete,
}: TestExecutionPanelProps) {
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>(
    savedComparisonModels || []
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [runNote, setRunNote] = useState("");
  const [iterations, setIterations] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentModel?: string;
    currentTestCase?: string;
  } | null>(null);
  const [streamingResults, setStreamingResults] = useState<ResultEvent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIconRef = useRef<RefreshCCWIconWIcon>(null);
  const airplaneRef = useRef<AirplaneIconHandle>(null);

  // Sync with saved models when they change
  useEffect(() => {
    if (savedComparisonModels) {
      setSelectedModels(savedComparisonModels);
    }
  }, [savedComparisonModels]);

  // Save models when selection changes
  const saveModels = useCallback(
    async (models: ModelSelection[]) => {
      try {
        await fetch(`/api/projects/${projectId}/test-suites/${suiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comparisonModels: models }),
        });
      } catch (err) {
        console.error("Failed to save comparison models:", err);
      }
    },
    [projectId, suiteId]
  );

  const handleModelsChange = (models: ModelSelection[]) => {
    setSelectedModels(models);
    saveModels(models);
  };

  const primaryModel = selectedModels.find((m) => m.isPrimary) || selectedModels[0];

  const runSingleModel = async (model: ModelSelection) => {
    if (!model) return;

    setRunning(true);
    setError("");
    setStreamingResults([]);

    // Check for missing API key
    if (!availableProviders[model.provider]) {
      setError(
        `Missing API key for: ${model.provider}. Configure it in Settings > API Keys.`
      );
      setRunning(false);
      return;
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}/run?stream=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelOverride: {
              provider: model.provider,
              model: model.model,
            },
            note: runNote || undefined,
            iterations,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
            testCaseIds: selectedTestCaseIds.length > 0 ? selectedTestCaseIds : undefined,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to run tests");
        onRunComplete({ success: false, error: data.error });
        return;
      }

      // Check if streaming response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream")) {
        // Handle SSE streaming
        await handleStreamingResponse(response, model.model);
      } else {
        // Fallback to JSON response
        const data = await response.json();
        onRunComplete({ success: true, testRun: data.testRun });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled
        setError("Test run cancelled");
        onRunComplete({ success: false, error: "Test run cancelled" });
      } else {
        const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
        setError(errorMessage);
        onRunComplete({ success: false, error: errorMessage });
      }
    } finally {
      setRunning(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Handle SSE streaming response
  const handleStreamingResponse = async (response: Response, modelName?: string) => {
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const results: ResultEvent[] = [];
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        const events = parseSSEEvents(buffer);

        // Keep any incomplete event in buffer
        const lastNewline = buffer.lastIndexOf("\n\n");
        if (lastNewline !== -1) {
          buffer = buffer.slice(lastNewline + 2);
        }

        for (const event of events) {
          if (isConnectedEvent(event)) {
            setProgress({
              current: 0,
              total: event.data.total,
              currentModel: modelName,
            });
          } else if (isProgressEvent(event)) {
            setProgress(prev => ({
              ...prev,
              current: event.data.current,
              total: event.data.total,
              currentTestCase: event.data.testCaseName,
            }));
          } else if (isResultEvent(event)) {
            results.push(event.data);
            setStreamingResults([...results]);
          } else if (isCompleteEvent(event)) {
            onRunComplete({ success: true, testRun: event.data.testRun });
            return;
          } else if (isErrorEvent(event)) {
            if (event.data.code === "EXECUTION_ERROR") {
              throw new Error(event.data.message);
            }
            // Individual test case errors are captured in results
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const runAllModels = async () => {
    if (selectedModels.length === 0) return;

    setRunning(true);
    setError("");
    setStreamingResults([]);

    // Check for missing API keys
    const missingKeys = selectedModels.filter(
      (m) => !availableProviders[m.provider]
    );
    if (missingKeys.length > 0) {
      const providers = [...new Set(missingKeys.map((m) => m.provider))];
      setError(
        `Missing API keys for: ${providers.join(", ")}. Configure them in Settings > API Keys.`
      );
      setRunning(false);
      return;
    }

    // Multi-model run - use streaming for each model
    const results: MultiModelRunResult["results"] = [];

    for (let i = 0; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      setProgress({
        current: i + 1,
        total: selectedModels.length,
        currentModel: model.model,
      });

      try {
        const response = await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/run?stream=true`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelOverride: { provider: model.provider, model: model.model },
              note: runNote || undefined,
              iterations,
              tags: selectedTags.length > 0 ? selectedTags : undefined,
              testCaseIds: selectedTestCaseIds.length > 0 ? selectedTestCaseIds : undefined,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          results.push({ model, error: data.error || "Failed to run tests" });
          continue;
        }

        // Handle streaming or JSON response
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("text/event-stream")) {
          // Consume streaming response and get final result
          const testRun = await consumeStreamingForMultiModel(response, model.model);
          if (testRun) {
            results.push({ model, testRun });
          } else {
            results.push({ model, error: "Failed to get test run results" });
          }
        } else {
          const data = await response.json();
          results.push({ model, testRun: data.testRun });
        }
      } catch (err) {
        results.push({
          model,
          error: err instanceof Error ? err.message : "Failed to run tests",
        });
      }
    }

    setProgress(null);
    setRunning(false);

    // Save comparison session if we have successful runs
    const successfulRuns = results.filter((r) => r.testRun);
    if (successfulRuns.length > 1) {
      try {
        await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/comparison-sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              models: selectedModels,
              runs: successfulRuns.map((r) => r.testRun),
            }),
          }
        );
      } catch (err) {
        console.error("Failed to save comparison session:", err);
      }
    }

    onRunComplete({ success: true, results });
  };

  // Consume streaming response for multi-model run (doesn't call onRunComplete)
  const consumeStreamingForMultiModel = async (response: Response, modelName?: string): Promise<TestRunResult["testRun"] | null> => {
    if (!response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: TestRunResult["testRun"] | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(buffer);

        const lastNewline = buffer.lastIndexOf("\n\n");
        if (lastNewline !== -1) {
          buffer = buffer.slice(lastNewline + 2);
        }

        for (const event of events) {
          if (isProgressEvent(event)) {
            setProgress(prev => prev ? ({
              ...prev,
              currentTestCase: event.data.testCaseName,
            }) : prev);
          } else if (isCompleteEvent(event)) {
            result = event.data.testRun;
          } else if (isErrorEvent(event) && event.data.code === "EXECUTION_ERROR") {
            throw new Error(event.data.message);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  };

  const canRunPrimary = primaryModel && testCaseCount > 0 && !running;
  const canRunAll = selectedModels.length > 1 && testCaseCount > 0 && !running;

  // Endpoint testing - simpler UI without model selection
  if (targetType === "endpoint") {
    const runEndpointTests = async () => {
      setRunning(true);
      setError("");
      setStreamingResults([]);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/run?stream=true`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              note: runNote || undefined,
              iterations,
              tags: selectedTags.length > 0 ? selectedTags : undefined,
              testCaseIds: selectedTestCaseIds.length > 0 ? selectedTestCaseIds : undefined,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to run tests");
          onRunComplete({ success: false, error: data.error });
          return;
        }

        // Check if streaming response
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("text/event-stream")) {
          await handleStreamingResponse(response);
        } else {
          const data = await response.json();
          onRunComplete({ success: true, testRun: data.testRun });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("Test run cancelled");
          onRunComplete({ success: false, error: "Test run cancelled" });
        } else {
          const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
          setError(errorMessage);
          onRunComplete({ success: false, error: errorMessage });
        }
      } finally {
        setRunning(false);
        setProgress(null);
        abortControllerRef.current = null;
      }
    };

    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Tests
          </CardTitle>
          <CardDescription>
            {testCaseCount > 0
              ? `Execute ${testCaseCount} test case${testCaseCount !== 1 ? "s" : ""} against your endpoint`
              : "Add test cases to run tests"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="relative">
            <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={runNote}
              onChange={(e) => setRunNote(e.target.value)}
              placeholder="Add a note for this run (optional)"
              className="pl-9"
              disabled={running}
              maxLength={500}
            />
          </div>

          {/* Primary Run Button */}
          <Button
            onClick={runEndpointTests}
            disabled={running || testCaseCount === 0}
            className="w-full"
            onMouseEnter={() => airplaneRef.current?.startAnimation()}
            onMouseLeave={() => airplaneRef.current?.stopAnimation()}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                Run tests
              </>
            )}
          </Button>

          {/* Additional run options */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Additional run options
                </span>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Tag Filter */}
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm text-muted-foreground">Filter by tags</Label>
                    {selectedTags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs ml-auto"
                        onClick={() => setSelectedTags([])}
                        disabled={running}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <Badge
                          key={tag}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => {
                            if (running) return;
                            if (isSelected) {
                              setSelectedTags(selectedTags.filter((t) => t !== tag));
                            } else {
                              setSelectedTags([...selectedTags, tag]);
                            }
                          }}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                  {selectedTags.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Running tests with any of the selected tags
                    </p>
                  )}
                </div>
              )}

              {/* Iterations */}
              <div className="flex items-center gap-2">
                <Label htmlFor="iterations-endpoint" className="text-sm text-muted-foreground whitespace-nowrap">
                  Runs:
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIterations(Math.max(1, iterations - 1))}
                  disabled={running || iterations <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="iterations-endpoint"
                  type="number"
                  min={1}
                  max={100}
                  value={iterations}
                  onChange={(e) => setIterations(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="h-8 w-16 text-center px-1"
                  disabled={running}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIterations(Math.min(100, iterations + 1))}
                  disabled={running || iterations >= 100}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  onClick={runEndpointTests}
                  disabled={running || testCaseCount === 0 || iterations < 2}
                  variant="secondary"
                  className="flex-1"
                  onMouseEnter={() => refreshIconRef.current?.startAnimation()}
                  onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
                >
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <RefreshCWIcon ref={refreshIconRef} size={16} className="mr-2" />
                      Run {iterations}x
                    </>
                  )}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {testCaseCount === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Add test cases first to run tests
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="h-5 w-5" />
          Run Tests
        </CardTitle>
        <CardDescription>
          {testCaseCount > 0
            ? `Execute ${testCaseCount} test case${testCaseCount !== 1 ? "s" : ""} on selected models`
            : "Add test cases to run tests"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <ModelCardSelector
          selectedModels={selectedModels}
          onChange={handleModelsChange}
          availableProviders={availableProviders}
          disabled={running}
        />

        <div className="relative">
          <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={runNote}
            onChange={(e) => setRunNote(e.target.value)}
            placeholder="Add a note for this run (optional)"
            className="pl-9"
            disabled={running}
            maxLength={500}
          />
        </div>

        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.currentModel ? (
                  <>Running model {progress.current}/{progress.total}</>
                ) : (
                  <>Running test {progress.current}/{progress.total}</>
                )}
              </span>
              <span className="font-mono text-xs truncate max-w-[150px]">
                {progress.currentTestCase || progress.currentModel}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={() => primaryModel && runSingleModel(primaryModel)}
          disabled={!canRunPrimary}
          className="w-full"
          onMouseEnter={() => airplaneRef.current?.startAnimation()}
          onMouseLeave={() => airplaneRef.current?.stopAnimation()}
        >
          {running && !progress ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : !primaryModel ? (
            <>
              <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
              Select Model
            </>
          ) : (
            <>
              <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
              Run tests
            </>
          )}
        </Button>

        {/* Additional run options */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Additional run options
              </span>
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">Filter by tags</Label>
                  {selectedTags.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto"
                      onClick={() => setSelectedTags([])}
                      disabled={running}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          if (running) return;
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter((t) => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
                {selectedTags.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Running tests with any of the selected tags
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label htmlFor="iterations-prompt" className="text-sm text-muted-foreground whitespace-nowrap">
                Runs:
              </Label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIterations(Math.max(1, iterations - 1))}
                disabled={running || iterations <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                id="iterations-prompt"
                type="number"
                min={1}
                max={100}
                value={iterations}
                onChange={(e) => setIterations(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="h-8 w-16 text-center px-1"
                disabled={running}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIterations(Math.min(100, iterations + 1))}
                disabled={running || iterations >= 100}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => primaryModel && runSingleModel(primaryModel)}
                disabled={!canRunPrimary || iterations < 2}
                variant="secondary"
                className="flex-1"
                onMouseEnter={() => refreshIconRef.current?.startAnimation()}
                onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
              >
                {running && !progress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCWIcon ref={refreshIconRef} size={16} className="mr-2" />
                    Run {iterations}x
                  </>
                )}
              </Button>
            </div>

            {selectedModels.length > 1 && (
              <Button
                onClick={runAllModels}
                disabled={!canRunAll}
                variant="outline"
                className="w-full"
              >
                {running && progress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running {progress.current}/{progress.total} models...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Run all {selectedModels.length} models
                  </>
                )}
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {testCaseCount === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Add test cases first to run tests
          </p>
        )}

        {selectedModels.length === 0 && testCaseCount > 0 && (
          <p className="text-xs text-red-500 text-center">
            Add at least one model to run tests
          </p>
        )}
      </CardContent>
    </Card>
  );
}
