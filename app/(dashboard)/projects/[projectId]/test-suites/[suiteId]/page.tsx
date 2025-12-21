"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArrowLeft, Save, FileText, Globe, Download } from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import { toast } from "sonner";
import {
  TestCaseEditor,
  TestCase,
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

interface Target {
  _id: string;
  name: string;
  variables: string[];
}

export default function TestSuiteDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; suiteId: string }>;
}) {
  const { projectId, suiteId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "test-cases";

  const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [llmJudgeConfig, setLlmJudgeConfig] = useState<LLMJudgeConfig>({
    enabled: false,
    criteria: [],
    validationRules: [],
  });
  const [lastRun, setLastRun] = useState<TestRun | null>(null);
  const [runHistory, setRunHistory] = useState<TestRun[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState("");
  const [storedApiKeys, setStoredApiKeys] = useState<{ openai: boolean; anthropic: boolean; gemini: boolean }>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const [multiModelResults, setMultiModelResults] = useState<MultiModelRunResult | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
      setTestCases(suite.testCases || []);
      setValidationRules(suite.validationRules || []);
      setLlmJudgeConfig(
        suite.llmJudgeConfig || { enabled: false, criteria: [], validationRules: [] }
      );
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

        // Extract variables
        let variables: string[] = [];
        if (suite.targetType === "prompt") {
          const version = targetObj.versions?.find(
            (v: { version: number }) =>
              v.version === (suite.targetVersion || targetObj.currentVersion)
          );
          variables = version?.variables || [];
        } else {
          variables = targetObj.variables || [];
        }

        setTarget({
          _id: targetObj._id,
          name: targetObj.name,
          variables,
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
            testCases,
            validationRules,
            llmJudgeConfig,
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
  const handleRunComplete = (result: TestRunResult | MultiModelRunResult) => {
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
    } else {
      // Single model result
      const singleResult = result as TestRunResult;
      if (singleResult.success && singleResult.testRun) {
        const newRun = singleResult.testRun as TestRun;
        setLastRun(newRun);
        setRunHistory((prev) => [newRun, ...prev]);
        setMultiModelResults(null); // Clear multi-model results
        toast.success("Tests completed!");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading test suite...</div>
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
          <div className="flex items-center gap-2 text-muted-foreground">
            {testSuite?.targetType === "prompt" ? (
              <FileText className="h-4 w-4" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            <span>Testing: {target?.name}</span>
            {testSuite?.targetVersion && (
              <Badge variant="outline">v{testSuite.targetVersion}</Badge>
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
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="test-cases">
                Test Cases
                {testCases.length > 0 && (
                  <Badge variant="secondary">
                    {testCases.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="validation">
                Validation
                {validationRules.length > 0 && (
                  <Badge variant="secondary">
                    {validationRules.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="judge">
                LLM Judge
                <Badge
                  variant={llmJudgeConfig.enabled ? "default" : "destructive"}
                >
                  {llmJudgeConfig.enabled ? "On" : "Off"}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="history">
                History
                {runHistory.length > 0 && (
                  <Badge variant="secondary">
                    {runHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="compare">
                Compare
              </TabsTrigger>
            </TabsList>

            <TabsContent value="test-cases" className="mt-4">
              <TestCaseEditor
                testCases={testCases}
                variables={target?.variables || []}
                onChange={(cases) => {
                  setTestCases(cases);
                  setHasChanges(true);
                }}
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <TestRunsGrid
                runs={runHistory}
                onSelectRun={(run) => setLastRun(run)}
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

        <div className="space-y-6">
          <TestExecutionPanel
            projectId={projectId}
            suiteId={suiteId}
            testCaseCount={testCases.length}
            targetType={testSuite?.targetType || "prompt"}
            availableProviders={storedApiKeys}
            savedComparisonModels={testSuite?.comparisonModels}
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
