"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Play, PlayCircle, StickyNote, Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RefreshCWIcon, RefreshCCWIconWIcon } from "@/components/ui/refresh-cw";
import { AirplaneIcon, AirplaneIconHandle } from "@/components/ui/airplane";
import { ModelCardSelector, ModelSelection } from "./ModelCardSelector";
import { Input } from "@/components/ui/input";

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
  onRunComplete: (result: TestRunResult | MultiModelRunResult) => void;
}

export function TestExecutionPanel({
  projectId,
  suiteId,
  testCaseCount,
  targetType,
  availableProviders,
  savedComparisonModels,
  onRunComplete,
}: TestExecutionPanelProps) {
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>(
    savedComparisonModels || []
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [runNote, setRunNote] = useState("");
  const [iterations, setIterations] = useState(1);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentModel?: string;
  } | null>(null);
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

    // Check for missing API key
    if (!availableProviders[model.provider]) {
      setError(
        `Missing API key for: ${model.provider}. Configure it in Settings > API Keys.`
      );
      setRunning(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}/run`,
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
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to run tests");
        onRunComplete({ success: false, error: data.error });
      } else {
        onRunComplete({ success: true, testRun: data.testRun });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
      setError(errorMessage);
      onRunComplete({ success: false, error: errorMessage });
    } finally {
      setRunning(false);
    }
  };

  const runAllModels = async () => {
    if (selectedModels.length === 0) return;

    setRunning(true);
    setError("");

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

    // Multi-model run
    setProgress({ current: 0, total: selectedModels.length });
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
          `/api/projects/${projectId}/test-suites/${suiteId}/run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelOverride: { provider: model.provider, model: model.model },
              note: runNote || undefined,
              iterations,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          results.push({ model, error: data.error || "Failed to run tests" });
        } else {
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

  const canRunPrimary = primaryModel && testCaseCount > 0 && !running;
  const canRunAll = selectedModels.length > 1 && testCaseCount > 0 && !running;

  // Endpoint testing - simpler UI without model selection
  if (targetType === "endpoint") {
    const runEndpointTests = async () => {
      setRunning(true);
      setError("");

      try {
        const response = await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              note: runNote || undefined,
              iterations,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to run tests");
          onRunComplete({ success: false, error: data.error });
        } else {
          onRunComplete({ success: true, testRun: data.testRun });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
        setError(errorMessage);
        onRunComplete({ success: false, error: errorMessage });
      } finally {
        setRunning(false);
      }
    };

    return (
      <Card>
        <CardHeader className="pb-3">
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

          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <Label htmlFor="iterations-endpoint" className="text-xs text-muted-foreground whitespace-nowrap">
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
                className="h-8 w-12 text-center px-1"
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
            </div>
            <Button
              onClick={runEndpointTests}
              disabled={running || testCaseCount === 0}
              className="flex-1"
              onMouseEnter={() => iterations === 1 ? airplaneRef.current?.startAnimation() : refreshIconRef.current?.startAnimation()}
              onMouseLeave={() => iterations === 1 ? airplaneRef.current?.stopAnimation() : refreshIconRef.current?.stopAnimation()}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : iterations === 1 ? (
                <>
                  <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                  Run Tests
                </>
              ) : (
                <>
                  <RefreshCWIcon ref={refreshIconRef} size={16} className="mr-2" />
                  Run {iterations}x
                </>
              )}
            </Button>
          </div>

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
                Running model {progress.current}/{progress.total}
              </span>
              <span className="font-mono text-xs">{progress.currentModel}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <Label htmlFor="iterations-prompt" className="text-xs text-muted-foreground whitespace-nowrap">
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
              className="h-8 w-12 text-center px-1"
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
          </div>
          <Button
            onClick={() => primaryModel && runSingleModel(primaryModel)}
            disabled={!canRunPrimary}
            className="flex-1"
            onMouseEnter={() => iterations === 1 ? airplaneRef.current?.startAnimation() : refreshIconRef.current?.startAnimation()}
            onMouseLeave={() => iterations === 1 ? airplaneRef.current?.stopAnimation() : refreshIconRef.current?.stopAnimation()}
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
            ) : iterations === 1 ? (
              <>
                <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                Run Primary
              </>
            ) : (
              <>
                <RefreshCWIcon ref={refreshIconRef} size={16} className="mr-2" />
                Run {iterations}x
              </>
            )}
          </Button>

          {selectedModels.length > 1 && (
            <Button
              onClick={runAllModels}
              disabled={!canRunAll}
              variant="outline"
              className="flex-1"
            >
              {running && progress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run All ({selectedModels.length})
                </>
              )}
            </Button>
          )}
        </div>

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
