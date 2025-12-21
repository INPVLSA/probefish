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
import { Loader2, Play, PlayCircle } from "lucide-react";
import { AirplaneIcon, AirplaneIconHandle } from "@/components/ui/airplane";
import { ModelCardSelector, ModelSelection } from "./ModelCardSelector";

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
  availableProviders: { openai: boolean; anthropic: boolean; gemini: boolean };
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
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentModel?: string;
  } | null>(null);
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
    onRunComplete({ success: true, results });
  };

  const canRunPrimary = primaryModel && testCaseCount > 0 && !running;
  const canRunAll = selectedModels.length > 1 && testCaseCount > 0 && !running;

  // Only show for prompts (endpoints don't have multi-model comparison)
  if (targetType !== "prompt") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Tests
          </CardTitle>
          <CardDescription>
            Execute all {testCaseCount} test case{testCaseCount !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled className="w-full">
            Endpoint testing uses configured URL
          </Button>
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

        <div className="flex gap-2">
          <Button
            onClick={() => primaryModel && runSingleModel(primaryModel)}
            disabled={!canRunPrimary}
            className="flex-1"
            onMouseEnter={() => airplaneRef.current?.startAnimation()}
            onMouseLeave={() => airplaneRef.current?.stopAnimation()}
          >
            {running && !progress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                {primaryModel ? "Run Primary" : "Select Model"}
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
