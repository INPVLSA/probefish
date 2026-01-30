/**
 * Parallel execution utility for running tests with concurrency control
 */

import { ITestCase } from "@/lib/db/models/testSuite";
import { TestCaseExecutionResult } from "./executor";

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}

export interface ParallelExecuteOptions {
  maxConcurrency: number;
  onProgress?: (index: number, testCase: ITestCase) => Promise<void>;
  onResult?: (result: TestCaseExecutionResult, index: number) => Promise<void>;
  abortSignal?: AbortSignal;
}

export interface ParallelExecuteResult {
  results: TestCaseExecutionResult[];
  aborted: boolean;
}

/**
 * Execute test cases in parallel with concurrency control
 *
 * @param testCases - Array of test cases to execute
 * @param executeFn - Function to execute a single test case
 * @param options - Parallel execution options
 * @returns Array of results in the same order as input test cases
 */
export async function executeTestsInParallel(
  testCases: ITestCase[],
  executeFn: (testCase: ITestCase) => Promise<TestCaseExecutionResult>,
  options: ParallelExecuteOptions
): Promise<ParallelExecuteResult> {
  const { maxConcurrency, onProgress, onResult, abortSignal } = options;
  const semaphore = new Semaphore(maxConcurrency);

  // Pre-allocate results array to maintain order
  const results: (TestCaseExecutionResult | null)[] = new Array(testCases.length).fill(null);
  let aborted = false;

  const executeWithSemaphore = async (
    testCase: ITestCase,
    index: number
  ): Promise<void> => {
    // Check for abort before acquiring semaphore
    if (abortSignal?.aborted) {
      aborted = true;
      return;
    }

    await semaphore.acquire();

    try {
      // Check for abort after acquiring semaphore
      if (abortSignal?.aborted) {
        aborted = true;
        return;
      }

      // Notify progress
      if (onProgress) {
        try {
          await onProgress(index, testCase);
        } catch {
          // Ignore progress callback errors
        }
      }

      // Execute the test case
      const result = await executeFn(testCase);
      results[index] = result;

      // Notify result
      if (onResult) {
        try {
          await onResult(result, index);
        } catch {
          // Ignore result callback errors
        }
      }
    } catch (error) {
      // Create error result for failed execution
      results[index] = {
        testCaseId: testCase._id,
        testCaseName: testCase.name,
        inputs: testCase.inputs,
        output: "",
        validationPassed: false,
        validationErrors: [error instanceof Error ? error.message : "Unknown error"],
        responseTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      if (onResult) {
        try {
          await onResult(results[index]!, index);
        } catch {
          // Ignore result callback errors
        }
      }
    } finally {
      semaphore.release();
    }
  };

  // Start all executions concurrently (semaphore limits actual parallelism)
  await Promise.all(
    testCases.map((testCase, index) => executeWithSemaphore(testCase, index))
  );

  // Filter out null results (from aborted executions) and cast to non-null
  const finalResults = results.filter((r): r is TestCaseExecutionResult => r !== null);

  return { results: finalResults, aborted };
}
