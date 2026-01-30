"use client";

import { useState, useEffect, use, useCallback, useMemo, useRef } from "react";
import { useHotkeyContext, useAppHotkey } from "@/lib/hotkeys";
import { ShortcutHint } from "@/components/hotkeys";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, FileText, Globe, Download, ExternalLink, Zap, Command } from "lucide-react";
import { FlaskIcon, FlaskIconHandle } from "@/components/ui/flask";
import { ShieldCheckIcon, ShieldCheckIconHandle } from "@/components/ui/shield-check";
import { BotIcon, BotIconHandle } from "@/components/ui/bot";
import { SettingsIcon, SettingsIconHandle } from "@/components/ui/settings";
import { HistoryIcon, HistoryIconHandle } from "@/components/ui/history";
import { GitCompareIcon, GitCompareIconHandle } from "@/components/ui/git-compare";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteIcon } from "@/components/ui/delete";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  TestCaseEditor,
  TestCase,
  TestCaseEditorHandle,
  ValidationRulesEditor,
  ValidationRule,
  JudgeConfigEditor,
  LLMJudgeConfig,
  TestExecutionPanel,
  TestRunResult,
  MultiModelRunResult,
  TestResults,
  TestRunsGrid,
  MultiModelResults,
  ComparisonSessionsViewer,
} from "@/components/testing";
import { ModelSelection } from "@/components/testing/ModelCardSelector";
import { TestRunComparison } from "@/components/testing/TestRunComparison";
import { ExportDialog } from "@/components/export/ExportDialog";

interface TestSuite {
  _id: string;
  name: string;
  description?: string;
  targetType: "prompt" | "endpoint";
  targetId: string;
  targetVersion?: number;
  testCases: TestCase[];
  validationRules: ValidationRule[];
  llmJudgeConfig: LLMJudgeConfig;
  comparisonModels?: ModelSelection[];
  parallelExecution?: boolean;
  lastRun?: TestRun;
  runHistory?: TestRun[];
}

interface TestRun {
  _id: string;
  runAt: string;
  status: "running" | "completed" | "failed";
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
}

interface PromptVersion {
  version: number;
  variables: string[];
  content: string;
  systemPrompt?: string;
}

interface Target {
  _id: string;
  name: string;
  variables: string[];
  content?: string;
  systemPrompt?: string;
  versions?: PromptVersion[];
  currentVersion?: number;
}

export default function TestSuiteDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; suiteId: string }>;
}) {
  const { projectId, suiteId } = use(params);
  const router = useRouter();

  // Tab state with URL hash sync
  const validTabs = ["test-cases", "validation", "judge", "settings", "history", "compare"];
  const [activeTab, setActiveTab] = useState("test-cases");

  // Animated icon refs
  const flaskIconRef = useRef<FlaskIconHandle>(null);
  const shieldCheckIconRef = useRef<ShieldCheckIconHandle>(null);
  const botIconRef = useRef<BotIconHandle>(null);
  const settingsIconRef = useRef<SettingsIconHandle>(null);
  const historyIconRef = useRef<HistoryIconHandle>(null);
  const gitCompareIconRef = useRef<GitCompareIconHandle>(null);

  // Test case editor ref
  const testCaseEditorRef = useRef<TestCaseEditorHandle>(null);

  // Read hash on mount and handle hash changes
  useEffect(() => {
    const getTabFromHash = () => {
      const hash = window.location.hash.slice(1); // Remove #
      return validTabs.includes(hash) ? hash : "test-cases";
    };

    setActiveTab(getTabFromHash());

    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, "", `#${value}`);

    // Trigger tab icon animation (reset first, then play)
    const iconRef = {
      "test-cases": flaskIconRef,
      "validation": shieldCheckIconRef,
      "judge": botIconRef,
      "settings": settingsIconRef,
      "history": historyIconRef,
      "compare": gitCompareIconRef,
    }[value];

    if (iconRef?.current) {
      iconRef.current.stopAnimation();
      setTimeout(() => iconRef.current?.startAnimation(), 300);
    }
  }, []);

  const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetVersion, setTargetVersion] = useState<number | undefined>();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [llmJudgeConfig, setLlmJudgeConfig] = useState<LLMJudgeConfig>({
    enabled: false,
    criteria: [],
    validationRules: [],
  });
  const [parallelExecution, setParallelExecution] = useState(false);
  const [lastRun, setLastRun] = useState<TestRun | null>(null);
  const [runHistory, setRunHistory] = useState<TestRun[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState("");
  const [storedApiKeys, setStoredApiKeys] = useState<{ openai: boolean; anthropic: boolean; gemini: boolean; grok: boolean; deepseek: boolean }>({
    openai: false,
    anthropic: false,
    gemini: false,
    grok: false,
    deepseek: false,
  });
  const [multiModelResults, setMultiModelResults] = useState<MultiModelRunResult | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Test case selection state for running individual/selected cases
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>([]);
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Compute available tags from test cases
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    testCases.forEach((tc) => tc.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [testCases]);

  // Hotkey scope management
  const { addScope, removeScope } = useHotkeyContext();

  useEffect(() => {
    addScope("test-suite");
    return () => removeScope("test-suite");
  }, [addScope, removeScope]);

  // Register tab navigation hotkeys
  useAppHotkey("nav-tab-1", useCallback(() => handleTabChange("test-cases"), [handleTabChange]));
  useAppHotkey("nav-tab-2", useCallback(() => handleTabChange("validation"), [handleTabChange]));
  useAppHotkey("nav-tab-3", useCallback(() => handleTabChange("judge"), [handleTabChange]));
  useAppHotkey("nav-tab-4", useCallback(() => handleTabChange("settings"), [handleTabChange]));
  useAppHotkey("nav-tab-5", useCallback(() => handleTabChange("history"), [handleTabChange]));
  useAppHotkey("nav-tab-6", useCallback(() => handleTabChange("compare"), [handleTabChange]));
  useAppHotkey("add-test-case", useCallback(() => {
    if (activeTab !== "test-cases") return;
    testCaseEditorRef.current?.openAddDialog();
  }, [activeTab]));

  const fetchTestSuite = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch test suite");
        return;
      }

      const suite = data.testSuite;
      setTestSuite(suite);
      setName(suite.name);
      setDescription(suite.description || "");
      setTargetVersion(suite.targetVersion ?? undefined);
      setTestCases(suite.testCases || []);
      setValidationRules(suite.validationRules || []);
      setLlmJudgeConfig(
        suite.llmJudgeConfig || { enabled: false, criteria: [], validationRules: [] }
      );
      setParallelExecution(suite.parallelExecution || false);
      setLastRun(suite.lastRun || null);
      setRunHistory(suite.runHistory || []);

      // Fetch target (prompt or endpoint)
      const targetUrl =
        suite.targetType === "prompt"
          ? `/api/projects/${projectId}/prompts/${suite.targetId}`
          : `/api/projects/${projectId}/endpoints/${suite.targetId}`;

      const targetRes = await fetch(targetUrl);
      if (targetRes.ok) {
        const targetData = await targetRes.json();
        const targetObj =
          suite.targetType === "prompt"
            ? targetData.prompt
            : targetData.endpoint;

        // Extract variables and content
        let variables: string[] = [];
        let content: string | undefined;
        let systemPrompt: string | undefined;
        let versions: PromptVersion[] | undefined;
        let currentVersion: number | undefined;

        if (suite.targetType === "prompt") {
          const version = targetObj.versions?.find(
            (v: { version: number }) =>
              v.version === (suite.targetVersion || targetObj.currentVersion)
          );
          variables = version?.variables || [];
          content = version?.content;
          systemPrompt = version?.systemPrompt;
          versions = targetObj.versions?.map((v: PromptVersion) => ({
            version: v.version,
            variables: v.variables,
            content: v.content,
            systemPrompt: v.systemPrompt,
          }));
          currentVersion = targetObj.currentVersion;
        } else {
          variables = targetObj.variables || [];
        }

        setTarget({
          _id: targetObj._id,
          name: targetObj.name,
          variables,
          content,
          systemPrompt,
          versions,
          currentVersion,
        });
      }

      // Fetch organization's stored API keys status
      if (suite.organizationId) {
        try {
          const keysRes = await fetch(`/api/organizations/${suite.organizationId}/api-keys`);
          if (keysRes.ok) {
            const keysData = await keysRes.json();
            // API returns { keys: { openai: { configured: true }, anthropic: { configured: true }, ... } }
            const keys = keysData.keys || {};
            setStoredApiKeys({
              openai: keys.openai?.configured === true,
              anthropic: keys.anthropic?.configured === true,
              gemini: keys.gemini?.configured === true,
              grok: keys.grok?.configured === true,
              deepseek: keys.deepseek?.configured === true,
            });
          }
        } catch {
          // Ignore error fetching API keys - will just show the modal
        }
      }
    } catch {
      setError("Failed to fetch test suite");
    } finally {
      setLoading(false);
    }
  }, [projectId, suiteId]);

  useEffect(() => {
    fetchTestSuite();
  }, [fetchTestSuite]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Test suite name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            targetVersion: targetVersion === undefined ? null : targetVersion,
            testCases,
            validationRules,
            llmJudgeConfig,
            parallelExecution,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save test suite");
        return;
      }

      setTestSuite(data.testSuite);
      setHasChanges(false);
      toast.success("Test suite saved!");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  // Register save hotkey (must be after handleSave is defined)
  const saveAction = useCallback(() => {
    if (hasChanges && !saving) {
      handleSave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, saving]);
  useAppHotkey("save-item", saveAction);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this test suite?")) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete test suite");
        return;
      }

      toast.success("Test suite deleted!");
      router.push(`/projects/${projectId}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setDeleting(false);
    }
  };

  // Unified handler for both single and multi-model results
  const handleRunComplete = useCallback((result: TestRunResult | MultiModelRunResult) => {
    // Reset running states
    setIsRunningTests(false);
    setRunningCaseId(null);

    // Check if it's a multi-model result
    if ("results" in result && Array.isArray(result.results)) {
      // Multi-model result
      const multiResult = result as MultiModelRunResult;
      setMultiModelResults(multiResult);

      // Update run history with all successful runs
      const successfulRuns = multiResult.results
        .filter((r) => r.testRun)
        .map((r) => r.testRun as TestRun);
      if (successfulRuns.length > 0) {
        setLastRun(successfulRuns[0]);
        setRunHistory((prev) => [...successfulRuns, ...prev]);
      }

      const successCount = successfulRuns.length;
      const failCount = multiResult.results.length - successCount;
      if (failCount === 0) {
        toast.success(`Tests completed on ${successCount} model${successCount !== 1 ? "s" : ""}!`);
      } else {
        toast.warning(`Tests completed on ${successCount} model${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
      }

      // Clear selection after successful multi-model run
      setSelectedTestCaseIds([]);
    } else {
      // Single model result
      const singleResult = result as TestRunResult;
      if (singleResult.success && singleResult.testRun) {
        const newRun = singleResult.testRun as TestRun;
        setLastRun(newRun);
        setRunHistory((prev) => [newRun, ...prev]);
        setMultiModelResults(null); // Clear multi-model results
        toast.success("Tests completed!");

        // Clear selection after successful run
        setSelectedTestCaseIds([]);
      }
    }
  }, []);

  // Run test cases with specific IDs
  const runTestCases = useCallback(async (testCaseIds: string[]) => {
    if (testCaseIds.length === 0) return;

    setIsRunningTests(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/test-suites/${suiteId}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testCaseIds,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to run tests");
        handleRunComplete({ success: false, error: data.error });
      } else {
        handleRunComplete({ success: true, testRun: data.testRun });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
      toast.error(errorMessage);
      handleRunComplete({ success: false, error: errorMessage });
    }
  }, [projectId, suiteId, handleRunComplete]);

  // Handler for running a single test case
  const handleRunSingleCase = useCallback(async (testCaseId: string) => {
    setRunningCaseId(testCaseId);
    setSelectedTestCaseIds([testCaseId]);
    await runTestCases([testCaseId]);
    setRunningCaseId(null);
  }, [runTestCases]);

  // Handler for running selected test cases
  const handleRunSelectedCases = useCallback(async () => {
    if (selectedTestCaseIds.length === 0) return;
    await runTestCases(selectedTestCaseIds);
  }, [selectedTestCaseIds, runTestCases]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Tabs area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs skeleton - matches Tabs component structure */}
            <div className="flex flex-col gap-2">
              <div className="bg-muted inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]">
                <Skeleton className="h-[calc(100%-1px)] w-24 rounded-md" />
                <Skeleton className="h-[calc(100%-1px)] w-24 rounded-md" />
                <Skeleton className="h-[calc(100%-1px)] w-24 rounded-md" />
                <Skeleton className="h-[calc(100%-1px)] w-20 rounded-md" />
                <Skeleton className="h-[calc(100%-1px)] w-20 rounded-md" />
                <Skeleton className="h-[calc(100%-1px)] w-20 rounded-md" />
              </div>
            </div>

            {/* Tab content placeholder */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4 min-h-[300px]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Execution panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-0">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3 min-h-[200px]">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error && !testSuite) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{testSuite?.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Testing:</span>
            {target && testSuite?.targetType === "prompt" && target?.content ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors bg-blue-500/15 hover:bg-blue-500/25 cursor-pointer"
                  >
                    <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-600 dark:text-blue-400">{target.name}</span>
                    <span className="text-muted-foreground">, {targetVersion ? `v${targetVersion}` : "Latest"}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>
                      {target.name} - {targetVersion ? `Version ${targetVersion}` : "Latest Version"}
                    </DialogTitle>
                    <DialogDescription>
                      {targetVersion
                        ? "Prompt content being tested"
                        : "Always uses the current version of the prompt"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-4">
                    <Link
                      href={`/projects/${projectId}/prompts/${target._id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Prompt
                    </Link>
                    {target.systemPrompt && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">System Prompt</Label>
                        <pre className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap overflow-x-auto">
                          {target.systemPrompt}
                        </pre>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">User Prompt</Label>
                      <pre className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap overflow-x-auto">
                        {target.content}
                      </pre>
                    </div>
                    {target.variables.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Variables</Label>
                        <div className="flex flex-wrap gap-2">
                          {target.variables.map((v) => (
                            <Badge key={v} variant="secondary">
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ) : target && (
              <Link
                href={`/projects/${projectId}/endpoints/${target._id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25"
              >
                <Globe className="h-3 w-3" />
                {target.name}
              </Link>
            )}
            {parallelExecution && (
              <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                <Zap className="h-3 w-3 mr-1" />
                Parallel
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setExportDialogOpen(true)}
          title="Export test suite"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
        >
          <DeleteIcon size={16} />
        </Button>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
          {!saving && <ShortcutHint keys="mod+s" />}
        </Button>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId}
        suiteId={suiteId}
        title="Export Test Suite"
      />

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Multi-model results shown full-width at top when available */}
      {multiModelResults && multiModelResults.results.length > 1 && (
        <MultiModelResults results={multiModelResults} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex items-center gap-3">
              <TabsList>
                <TabsTrigger value="test-cases">
                  <FlaskIcon ref={flaskIconRef} size={14} />
                  Test Cases
                  {testCases.length > 0 && (
                    <Badge variant="secondary">
                      {testCases.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="validation">
                  <ShieldCheckIcon ref={shieldCheckIconRef} size={14} />
                  Validation
                  {validationRules.length > 0 && (
                    <Badge variant="secondary">
                      {validationRules.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="judge">
                  <BotIcon ref={botIconRef} size={14} />
                  LLM Judge
                  <Badge
                    variant={llmJudgeConfig.enabled ? "default" : "destructive"}
                  >
                    {llmJudgeConfig.enabled ? "On" : "Off"}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <SettingsIcon ref={settingsIconRef} size={14} />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="history">
                  <HistoryIcon ref={historyIconRef} size={14} />
                  History
                  {runHistory.length > 0 && (
                    <Badge variant="secondary">
                      {runHistory.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="compare">
                  <GitCompareIcon ref={gitCompareIconRef} size={14} />
                  Compare
                </TabsTrigger>
              </TabsList>
              <Tooltip>
                <TooltipTrigger asChild>
                  <kbd className="font-mono text-[11px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 cursor-help"><Command className="h-[11px] w-[11px] -mt-px" />1-6</kbd>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <div className="space-y-1">
                    <div><kbd className="font-mono">⌘1</kbd> Test Cases</div>
                    <div><kbd className="font-mono">⌘2</kbd> Validation</div>
                    <div><kbd className="font-mono">⌘3</kbd> LLM Judge</div>
                    <div><kbd className="font-mono">⌘4</kbd> Settings</div>
                    <div><kbd className="font-mono">⌘5</kbd> History</div>
                    <div><kbd className="font-mono">⌘6</kbd> Compare</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            <TabsContent value="test-cases" className="mt-4">
              <TestCaseEditor
                ref={testCaseEditorRef}
                testCases={testCases}
                variables={target?.variables || []}
                targetType={testSuite?.targetType}
                onChange={(cases) => {
                  setTestCases(cases);
                  setHasChanges(true);
                }}
                selectedCaseIds={selectedTestCaseIds}
                onSelectionChange={setSelectedTestCaseIds}
                onRunSingleCase={handleRunSingleCase}
                onRunSelectedCases={handleRunSelectedCases}
                running={isRunningTests}
                runningCaseId={runningCaseId}
              />
            </TabsContent>

            <TabsContent value="validation" className="mt-4">
              <ValidationRulesEditor
                rules={validationRules}
                onChange={(rules) => {
                  setValidationRules(rules);
                  setHasChanges(true);
                }}
              />
            </TabsContent>

            <TabsContent value="judge" className="mt-4">
              <JudgeConfigEditor
                config={llmJudgeConfig}
                onChange={(config) => {
                  setLlmJudgeConfig(config);
                  setHasChanges(true);
                }}
                availableProviders={storedApiKeys}
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Suite Settings</CardTitle>
                  <CardDescription>
                    Basic test suite configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="suite-name">Name</Label>
                    <Input
                      id="suite-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setHasChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suite-description">Description</Label>
                    <Textarea
                      id="suite-description"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setHasChanges(true);
                      }}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <Label htmlFor="parallel-execution" className="font-medium">
                          Parallel Execution
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Run test cases concurrently for faster execution. Concurrency is
                        limited by your organization&apos;s settings.
                      </p>
                    </div>
                    <Switch
                      id="parallel-execution"
                      checked={parallelExecution}
                      onCheckedChange={(checked) => {
                        setParallelExecution(checked);
                        setHasChanges(true);
                      }}
                    />
                  </div>
                  {testSuite?.targetType === "prompt" && target?.versions && (
                    <div className="space-y-2">
                      <Label>Prompt Version</Label>
                      <Select
                        value={targetVersion === undefined ? "latest" : String(targetVersion)}
                        onValueChange={(v) => {
                          setTargetVersion(v === "latest" ? undefined : parseInt(v, 10));
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest">
                            Latest (always use current)
                          </SelectItem>
                          {target.versions.map((v) => (
                            <SelectItem key={v.version} value={String(v.version)}>
                              Version {v.version}
                              {v.version === target.currentVersion && " (current)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {targetVersion === undefined
                          ? "Tests will always run against the current version of the prompt"
                          : `Tests will run against version ${targetVersion}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-6">
              {testSuite?.targetType === "prompt" && (
                <ComparisonSessionsViewer
                  projectId={projectId}
                  suiteId={suiteId}
                  onSelectSession={(session) => {
                    // Convert session to MultiModelRunResult format and display
                    const results = session.runs.map((run) => ({
                      model: {
                        provider: run.modelOverride?.provider as "openai" | "anthropic" | "gemini",
                        model: run.modelOverride?.model || "",
                      },
                      testRun: run,
                    }));
                    setMultiModelResults({ success: true, results });
                  }}
                />
              )}
              <TestRunsGrid
                runs={runHistory}
                projectId={projectId}
                suiteId={suiteId}
                onSelectRun={(run) => setLastRun(run)}
                onRunUpdated={fetchTestSuite}
              />
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <TestRunComparison
                projectId={projectId}
                suiteId={suiteId}
                runs={runHistory}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6 lg:sticky lg:top-0 lg:self-start">
          <TestExecutionPanel
            projectId={projectId}
            suiteId={suiteId}
            testCaseCount={selectedTestCaseIds.length > 0 ? selectedTestCaseIds.length : testCases.length}
            targetType={testSuite?.targetType || "prompt"}
            availableProviders={storedApiKeys}
            savedComparisonModels={testSuite?.comparisonModels}
            availableTags={availableTags}
            selectedTestCaseIds={selectedTestCaseIds}
            parallelExecution={parallelExecution}
            onRunComplete={handleRunComplete}
          />

          {/* Single model results shown in sidebar */}
          {(!multiModelResults || multiModelResults.results.length <= 1) && (
            <TestResults testRun={lastRun} />
          )}
        </div>
      </div>
    </div>
  );
}
