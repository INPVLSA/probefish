"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Key, Play, Layers, ChevronDown, Repeat, Tag, X } from "lucide-react";
import { AirplaneIcon, AirplaneIconHandle } from "@/components/ui/airplane";
import { MultiModelSelector, ModelSelection } from "./MultiModelSelector";

interface TestRunnerProps {
  projectId: string;
  suiteId: string;
  testCaseCount: number;
  targetType?: "prompt" | "endpoint";
  needsOpenAI?: boolean;
  needsAnthropic?: boolean;
  availableProviders?: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
    grok: boolean;
    deepseek: boolean;
  };
  savedComparisonModels?: ModelSelection[];
  availableTags?: string[];
  onRunComplete?: (result: TestRunResult) => void;
  onMultiModelRunComplete?: (results: MultiModelRunResult) => void;
}

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
      output: string;
      validationPassed: boolean;
      validationErrors: string[];
      judgeScore?: number;
      judgeScores?: Record<string, number>;
      judgeReasoning?: string;
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

export function TestRunner({
  projectId,
  suiteId,
  testCaseCount,
  targetType = "prompt",
  needsOpenAI = false,
  needsAnthropic = false,
  availableProviders = { openai: true, anthropic: true, gemini: true, grok: true, deepseek: true },
  savedComparisonModels,
  availableTags = [],
  onRunComplete,
  onMultiModelRunComplete,
}: TestRunnerProps) {
  const [running, setRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [error, setError] = useState("");
  const [multiModelOpen, setMultiModelOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>(
    savedComparisonModels || []
  );
  const [multiModelProgress, setMultiModelProgress] = useState<{
    current: number;
    total: number;
    currentModel?: string;
  } | null>(null);
  const [iterations, setIterations] = useState(1);
  const [iterationsProgress, setIterationsProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const airplaneRef = useRef<AirplaneIconHandle>(null);

  // Initialize from saved models
  useEffect(() => {
    if (savedComparisonModels && savedComparisonModels.length > 0) {
      setSelectedModels(savedComparisonModels);
      setMultiModelOpen(true);
    }
  }, [savedComparisonModels]);

  // Save models when selection changes
  const saveComparisonModels = useCallback(
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

  const handleModelSelectionChange = (models: ModelSelection[]) => {
    setSelectedModels(models);
    saveComparisonModels(models);
  };

  const handleRunClick = () => {
    if (needsOpenAI || needsAnthropic) {
      setDialogOpen(true);
    } else {
      runTests();
    }
  };

  const runTests = async (modelOverride?: ModelSelection, iterationCount?: number) => {
    setRunning(true);
    setError("");
    setDialogOpen(false);

    const effectiveIterations = iterationCount ?? iterations;
    if (effectiveIterations > 1) {
      setIterationsProgress({ current: 0, total: effectiveIterations * testCaseCount });
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            openaiApiKey: openaiKey || undefined,
            anthropicApiKey: anthropicKey || undefined,
            iterations: effectiveIterations,
            modelOverride: modelOverride
              ? { provider: modelOverride.provider, model: modelOverride.model }
              : undefined,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to run tests");
        onRunComplete?.({ success: false, error: data.error });
        return { success: false, error: data.error };
      } else {
        onRunComplete?.({ success: true, testRun: data.testRun });
        return { success: true, testRun: data.testRun };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
      setError(errorMessage);
      onRunComplete?.({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      if (!multiModelProgress) {
        setRunning(false);
        setIterationsProgress(null);
      }
    }
  };

  const runMultiModelTests = async () => {
    if (selectedModels.length === 0) return;

    setRunning(true);
    setError("");
    setMultiModelProgress({ current: 0, total: selectedModels.length });

    const results: MultiModelRunResult["results"] = [];

    for (let i = 0; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      setMultiModelProgress({
        current: i + 1,
        total: selectedModels.length,
        currentModel: model.model,
      });

      try {
        const response = await fetch(
          `/api/projects/${projectId}/test-suites/${suiteId}/run`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              openaiApiKey: openaiKey || undefined,
              anthropicApiKey: anthropicKey || undefined,
              modelOverride: { provider: model.provider, model: model.model },
              tags: selectedTags.length > 0 ? selectedTags : undefined,
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

    setMultiModelProgress(null);
    setRunning(false);
    onMultiModelRunComplete?.({ success: true, results });
  };

  return (
    <>
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
        <CardContent className="space-y-3">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          {multiModelProgress && (
            <div className="text-sm bg-muted/50 px-3 py-2 rounded-md">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Running model {multiModelProgress.current}/{multiModelProgress.total}
                </span>
              </div>
              {multiModelProgress.currentModel && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {multiModelProgress.currentModel}
                </p>
              )}
            </div>
          )}

          {iterationsProgress && (
            <div className="text-sm bg-muted/50 px-3 py-2 rounded-md">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Running {iterations}x iterations...
                </span>
              </div>
            </div>
          )}

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={running}
                    >
                      <Tag className="h-3 w-3" />
                      Filter by tags
                      {selectedTags.length > 0 && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                          {selectedTags.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground px-1">
                        Select tags to filter test cases (OR logic)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <Badge
                              key={tag}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer hover:bg-muted"
                              onClick={() => {
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => setSelectedTags([])}
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap flex-1">
                    {selectedTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="pl-2 pr-1 py-0.5 gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                          className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                          disabled={running}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Running tests with any of the selected tags
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Label htmlFor="iterations" className="text-xs text-muted-foreground whitespace-nowrap">
                <Repeat className="h-3 w-3 inline mr-1" />
                Runs:
              </Label>
              <Input
                id="iterations"
                type="number"
                min={1}
                max={100}
                value={iterations}
                onChange={(e) => setIterations(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="h-8 w-16 text-center"
                disabled={running}
              />
            </div>
            <Button
              onClick={handleRunClick}
              disabled={running || testCaseCount === 0}
              className="flex-1"
              onMouseEnter={() => airplaneRef.current?.startAnimation()}
              onMouseLeave={() => airplaneRef.current?.stopAnimation()}
            >
              {running && !multiModelProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                  Run {iterations}x
                </>
              )}
            </Button>
          </div>

          {testCaseCount === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Add test cases to run tests
            </p>
          )}

          {/* Multi-model comparison for prompts */}
          {targetType === "prompt" && testCaseCount > 0 && (
            <Collapsible open={multiModelOpen} onOpenChange={setMultiModelOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Compare Models
                    {selectedModels.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {selectedModels.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      multiModelOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <MultiModelSelector
                  selectedModels={selectedModels}
                  onChange={handleModelSelectionChange}
                  availableProviders={availableProviders}
                />
                <Button
                  onClick={runMultiModelTests}
                  disabled={running || selectedModels.length === 0}
                  variant="secondary"
                  className="w-full"
                >
                  {running && multiModelProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running {multiModelProgress.current}/{multiModelProgress.total}...
                    </>
                  ) : (
                    <>
                      <Layers className="mr-2 h-4 w-4" />
                      Run on {selectedModels.length} Model{selectedModels.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys Required
            </DialogTitle>
            <DialogDescription>
              Enter API keys to run tests. Keys are only used for this test run and are
              not stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {needsOpenAI && (
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            )}
            {needsAnthropic && (
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => runTests()}
              disabled={
                (needsOpenAI && !openaiKey) || (needsAnthropic && !anthropicKey)
              }
            >
              Run Tests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
