/**
 * Streaming executor for test suite runs
 * Wraps the standard executor with callbacks for real-time progress streaming
 */

import mongoose from "mongoose";
import { ITestCase, ITestResult, IValidationRule, ILLMJudgeConfig, ITestRun } from "@/lib/db/models/testSuite";
import { IPrompt } from "@/lib/db/models/prompt";
import { IEndpoint } from "@/lib/db/models/endpoint";
import { LLMProviderCredentials } from "@/lib/llm";
import { executeTestCase, toTestResult, ModelOverride, TestCaseExecutionResult } from "./executor";
import { executeTestsInParallel } from "./parallelExecutor";

export interface StreamingProgress {
  current: number;
  total: number;
  iteration: number;
  testCaseId: string;
  testCaseName: string;
}

export interface StreamingCallbacks {
  onProgress: (progress: StreamingProgress) => Promise<void>;
  onResult: (result: ITestResult) => Promise<void>;
  onError: (error: Error, testCaseId?: string) => Promise<void>;
}

export interface StreamingExecuteParams {
  testCases: ITestCase[];
  targetType: "prompt" | "endpoint";
  target: IPrompt | IEndpoint;
  targetVersion?: number;
  validationRules: IValidationRule[];
  judgeConfig: ILLMJudgeConfig;
  credentials: LLMProviderCredentials;
  modelOverride?: ModelOverride;
  iterations: number;
  runId: mongoose.Types.ObjectId;
  runBy: mongoose.Types.ObjectId;
  note?: string;
  parallelExecution?: boolean;
  maxConcurrency?: number;
}

export interface StreamingExecuteResult {
  testRun: ITestRun;
  aborted: boolean;
}

/**
 * Execute test suite with streaming callbacks
 * Calls onProgress before each test and onResult after each test completes
 */
export async function executeTestSuiteWithStreaming(
  params: StreamingExecuteParams,
  callbacks: StreamingCallbacks,
  abortSignal?: AbortSignal
): Promise<StreamingExecuteResult> {
  const {
    testCases,
    targetType,
    target,
    targetVersion,
    validationRules,
    judgeConfig,
    credentials,
    modelOverride,
    iterations,
    runId,
    runBy,
    note,
    parallelExecution = false,
    maxConcurrency = 5,
  } = params;

  const totalTestCount = testCases.length * iterations;
  const results: ITestResult[] = [];
  let totalResponseTime = 0;
  let totalJudgeScore = 0;
  let judgeScoreCount = 0;
  let passed = 0;
  let failed = 0;
  let aborted = false;

  // Create the test run object
  const testRun: ITestRun = {
    _id: runId,
    runAt: new Date(),
    runBy,
    status: "running",
    note,
    iterations: iterations > 1 ? iterations : undefined,
    modelOverride: modelOverride ? {
      provider: modelOverride.provider,
      model: modelOverride.model,
    } : undefined,
    results: [],
    summary: {
      total: totalTestCount,
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
    },
  };

  let completedCount = 0;

  for (let iteration = 1; iteration <= iterations; iteration++) {
    if (abortSignal?.aborted) {
      aborted = true;
      break;
    }

    if (parallelExecution) {
      // Parallel execution with streaming callbacks
      const { results: iterationResults, aborted: iterationAborted } = await executeTestsInParallel(
        testCases,
        async (testCase) => {
          return executeTestCase({
            testCase,
            targetType,
            target,
            targetVersion,
            validationRules,
            judgeConfig,
            credentials,
            modelOverride,
          });
        },
        {
          maxConcurrency,
          abortSignal,
          onProgress: async (index, testCase) => {
            completedCount++;
            try {
              await callbacks.onProgress({
                current: completedCount,
                total: totalTestCount,
                iteration,
                testCaseId: testCase._id.toString(),
                testCaseName: testCase.name,
              });
            } catch {
              // Stream may be closed
            }
          },
          onResult: async (result, _index) => {
            const testResult = toTestResult(result);
            if (iterations > 1) {
              testResult.iteration = iteration;
            }
            results.push(testResult);

            // Update running stats
            if (result.validationPassed && !result.error) {
              passed++;
            } else {
              failed++;
            }

            totalResponseTime += result.responseTime;

            if (typeof result.judgeScore === "number") {
              totalJudgeScore += result.judgeScore;
              judgeScoreCount++;
            }

            try {
              await callbacks.onResult(testResult);
            } catch {
              // Stream may be closed
            }
          },
        }
      );

      if (iterationAborted) {
        aborted = true;
        break;
      }
    } else {
      // Sequential execution (default)
      for (const testCase of testCases) {
        // Check for abort signal
        if (abortSignal?.aborted) {
          aborted = true;
          break;
        }

        completedCount++;

        // Send progress event
        try {
          await callbacks.onProgress({
            current: completedCount,
            total: totalTestCount,
            iteration,
            testCaseId: testCase._id.toString(),
            testCaseName: testCase.name,
          });
        } catch {
          // Stream may be closed
        }

        // Execute the test case
        let result: TestCaseExecutionResult;
        try {
          result = await executeTestCase({
            testCase,
            targetType,
            target,
            targetVersion,
            validationRules,
            judgeConfig,
            credentials,
            modelOverride,
          });
        } catch (error) {
          // If execution itself throws, create an error result
          const errorResult: TestCaseExecutionResult = {
            testCaseId: testCase._id,
            testCaseName: testCase.name,
            inputs: testCase.inputs,
            output: "",
            validationPassed: false,
            validationErrors: [error instanceof Error ? error.message : "Unknown error"],
            responseTime: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          };
          result = errorResult;

          try {
            await callbacks.onError(error instanceof Error ? error : new Error("Unknown error"), testCase._id.toString());
          } catch {
            // Stream may be closed
          }
        }

        // Convert to test result and track stats
        const testResult = toTestResult(result);
        if (iterations > 1) {
          testResult.iteration = iteration;
        }

        results.push(testResult);

        // Update running stats
        if (result.validationPassed && !result.error) {
          passed++;
        } else {
          failed++;
        }

        totalResponseTime += result.responseTime;

        if (typeof result.judgeScore === "number") {
          totalJudgeScore += result.judgeScore;
          judgeScoreCount++;
        }

        // Send result event
        try {
          await callbacks.onResult(testResult);
        } catch {
          // Stream may be closed
        }
      }

      if (aborted) break;
    }
  }

  // Calculate final stats
  testRun.results = results;
  testRun.summary = {
    total: totalTestCount,
    passed,
    failed,
    avgResponseTime: results.length > 0 ? Math.round(totalResponseTime / results.length) : 0,
  };

  if (judgeScoreCount > 0) {
    testRun.summary.avgScore = Math.round((totalJudgeScore / judgeScoreCount) * 100) / 100;
  }

  testRun.status = aborted ? "failed" : "completed";

  return { testRun, aborted };
}
