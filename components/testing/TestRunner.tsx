"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Key, Play } from "lucide-react";
import { AirplaneIcon, AirplaneIconHandle } from "@/components/ui/airplane";

interface TestRunnerProps {
  projectId: string;
  suiteId: string;
  testCaseCount: number;
  needsOpenAI?: boolean;
  needsAnthropic?: boolean;
  onRunComplete?: (result: TestRunResult) => void;
}

export interface TestRunResult {
  success: boolean;
  testRun?: {
    _id: string;
    status: string;
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

export function TestRunner({
  projectId,
  suiteId,
  testCaseCount,
  needsOpenAI = false,
  needsAnthropic = false,
  onRunComplete,
}: TestRunnerProps) {
  const [running, setRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [error, setError] = useState("");
  const airplaneRef = useRef<AirplaneIconHandle>(null);

  const handleRunClick = () => {
    if (needsOpenAI || needsAnthropic) {
      setDialogOpen(true);
    } else {
      runTests();
    }
  };

  const runTests = async () => {
    setRunning(true);
    setError("");
    setDialogOpen(false);

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
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to run tests");
        onRunComplete?.({ success: false, error: data.error });
      } else {
        onRunComplete?.({ success: true, testRun: data.testRun });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run tests";
      setError(errorMessage);
      onRunComplete?.({ success: false, error: errorMessage });
    } finally {
      setRunning(false);
    }
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
        <CardContent>
          {error && (
            <div className="mb-3 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          <Button
            onClick={handleRunClick}
            disabled={running || testCaseCount === 0}
            className="w-full"
            onMouseEnter={() => airplaneRef.current?.startAnimation()}
            onMouseLeave={() => airplaneRef.current?.stopAnimation()}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <AirplaneIcon ref={airplaneRef} size={16} className="mr-2" />
                Run All Tests
              </>
            )}
          </Button>
          {testCaseCount === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Add test cases to run tests
            </p>
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
              onClick={runTests}
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
