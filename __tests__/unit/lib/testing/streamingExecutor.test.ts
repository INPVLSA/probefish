import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { executeTestSuiteWithStreaming, StreamingCallbacks, StreamingExecuteParams } from '@/lib/testing/streamingExecutor';
import { ITestCase, IValidationRule, ILLMJudgeConfig } from '@/lib/db/models/testSuite';
import { IPrompt } from '@/lib/db/models/prompt';

// Mock the executor module
vi.mock('@/lib/testing/executor', () => ({
  executeTestCase: vi.fn(),
  toTestResult: vi.fn((result) => ({
    testCaseId: result.testCaseId,
    testCaseName: result.testCaseName,
    inputs: result.inputs,
    output: result.output,
    validationPassed: result.validationPassed,
    validationErrors: result.validationErrors,
    judgeScore: result.judgeScore,
    responseTime: result.responseTime,
    error: result.error,
  })),
}));

// Mock the parallel executor module
vi.mock('@/lib/testing/parallelExecutor', () => ({
  executeTestsInParallel: vi.fn(),
}));

import { executeTestCase, toTestResult } from '@/lib/testing/executor';
import { executeTestsInParallel } from '@/lib/testing/parallelExecutor';

// Helper to create mock test case
function createMockTestCase(id: string, name: string): ITestCase {
  return {
    _id: new mongoose.Types.ObjectId(id.padStart(24, '0')),
    name,
    inputs: { query: `input for ${name}` },
    enabled: true,
  } as ITestCase;
}

// Helper to create mock execution result
function createMockExecutionResult(testCase: ITestCase, passed: boolean = true) {
  return {
    testCaseId: testCase._id,
    testCaseName: testCase.name,
    inputs: testCase.inputs,
    output: `output for ${testCase.name}`,
    validationPassed: passed,
    validationErrors: passed ? [] : ['Validation failed'],
    responseTime: 100,
    error: passed ? undefined : 'Test failed',
  };
}

// Helper to create base params
function createBaseParams(testCases: ITestCase[], overrides: Partial<StreamingExecuteParams> = {}): StreamingExecuteParams {
  return {
    testCases,
    targetType: 'prompt',
    target: {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Prompt',
      versions: [{
        version: 1,
        content: 'Test content',
        variables: [],
      }],
      currentVersion: 1,
    } as unknown as IPrompt,
    validationRules: [] as IValidationRule[],
    judgeConfig: { enabled: false, criteria: [], validationRules: [] } as ILLMJudgeConfig,
    credentials: {},
    iterations: 1,
    runId: new mongoose.Types.ObjectId(),
    runBy: new mongoose.Types.ObjectId(),
    parallelExecution: false,
    maxConcurrency: 5,
    ...overrides,
  };
}

// Helper to create mock callbacks
function createMockCallbacks(): StreamingCallbacks {
  return {
    onProgress: vi.fn().mockResolvedValue(undefined),
    onResult: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn().mockResolvedValue(undefined),
  };
}

describe('executeTestSuiteWithStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sequential execution (parallelExecution: false)', () => {
    it('should execute test cases sequentially by default', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      const executionOrder: string[] = [];
      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        executionOrder.push(testCase.name);
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(executeTestCase).toHaveBeenCalledTimes(2);
      expect(executionOrder).toEqual(['Test 1', 'Test 2']);
      expect(executeTestsInParallel).not.toHaveBeenCalled();
    });

    it('should call onProgress before each test', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(callbacks.onProgress).toHaveBeenCalledTimes(2);
      expect(callbacks.onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
        current: 1,
        total: 2,
        testCaseName: 'Test 1',
      }));
      expect(callbacks.onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
        current: 2,
        total: 2,
        testCaseName: 'Test 2',
      }));
    });

    it('should call onResult after each test', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
      ];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(callbacks.onResult).toHaveBeenCalledTimes(1);
      expect(callbacks.onResult).toHaveBeenCalledWith(expect.objectContaining({
        testCaseName: 'Test 1',
        validationPassed: true,
      }));
    });

    it('should call onError when execution throws', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
      ];

      vi.mocked(executeTestCase).mockRejectedValue(new Error('Execution error'));

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(String)
      );
      expect(testRun.summary.failed).toBe(1);
    });
  });

  describe('parallel execution (parallelExecution: true)', () => {
    it('should use executeTestsInParallel when parallelExecution is true', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: testCases.map(tc => createMockExecutionResult(tc)),
        aborted: false,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: true, maxConcurrency: 3 });

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(executeTestsInParallel).toHaveBeenCalledTimes(1);
      expect(executeTestsInParallel).toHaveBeenCalledWith(
        testCases,
        expect.any(Function),
        expect.objectContaining({
          maxConcurrency: 3,
        })
      );
      // Sequential executeTestCase should not be called directly
      expect(executeTestCase).not.toHaveBeenCalled();
    });

    it('should pass maxConcurrency to parallel executor', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: [createMockExecutionResult(testCases[0])],
        aborted: false,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: true, maxConcurrency: 10 });

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(executeTestsInParallel).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          maxConcurrency: 10,
        })
      );
    });

    it('should handle abort from parallel execution', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: [createMockExecutionResult(testCases[0])],
        aborted: true,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: true });

      const { testRun, aborted } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(aborted).toBe(true);
      expect(testRun.status).toBe('failed');
    });

    it('should use default maxConcurrency of 5 when not specified', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: [createMockExecutionResult(testCases[0])],
        aborted: false,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: true });
      delete (params as Partial<StreamingExecuteParams>).maxConcurrency;

      await executeTestSuiteWithStreaming(params, callbacks);

      expect(executeTestsInParallel).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          maxConcurrency: 5,
        })
      );
    });
  });

  describe('iterations', () => {
    it('should run multiple iterations sequentially', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { iterations: 3, parallelExecution: false });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(executeTestCase).toHaveBeenCalledTimes(3);
      expect(testRun.summary.total).toBe(3);
      expect(callbacks.onProgress).toHaveBeenCalledTimes(3);
    });

    it('should run multiple iterations with parallel execution', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: testCases.map(tc => createMockExecutionResult(tc)),
        aborted: false,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { iterations: 2, parallelExecution: true });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      // Should call parallel executor once per iteration
      expect(executeTestsInParallel).toHaveBeenCalledTimes(2);
      expect(testRun.summary.total).toBe(4); // 2 tests × 2 iterations
    });

    it('should add iteration number to results when iterations > 1', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { iterations: 2, parallelExecution: false });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(testRun.results[0].iteration).toBe(1);
      expect(testRun.results[1].iteration).toBe(2);
    });
  });

  describe('summary calculation', () => {
    it('should calculate correct pass/fail counts', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        const tc = testCase as ITestCase;
        const passed = tc.name !== 'Test 2'; // Test 2 fails
        return createMockExecutionResult(tc, passed);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(testRun.summary.total).toBe(3);
      expect(testRun.summary.passed).toBe(2);
      expect(testRun.summary.failed).toBe(1);
    });

    it('should calculate average response time', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      vi.mocked(executeTestCase)
        .mockResolvedValueOnce({ ...createMockExecutionResult(testCases[0]), responseTime: 100 })
        .mockResolvedValueOnce({ ...createMockExecutionResult(testCases[1]), responseTime: 200 });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      const { testRun } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(testRun.summary.avgResponseTime).toBe(150); // (100 + 200) / 2
    });

    it('should set status to completed when not aborted', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        return createMockExecutionResult(testCase as ITestCase);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      const { testRun, aborted } = await executeTestSuiteWithStreaming(params, callbacks);

      expect(aborted).toBe(false);
      expect(testRun.status).toBe('completed');
    });
  });

  describe('abort signal handling', () => {
    it('should stop sequential execution when aborted', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const abortController = new AbortController();

      vi.mocked(executeTestCase).mockImplementation(async ({ testCase }) => {
        const tc = testCase as ITestCase;
        if (tc.name === 'Test 2') {
          abortController.abort();
        }
        return createMockExecutionResult(tc);
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: false });

      const { aborted } = await executeTestSuiteWithStreaming(params, callbacks, abortController.signal);

      expect(aborted).toBe(true);
      // Should not have executed Test 3
      expect(executeTestCase).toHaveBeenCalledTimes(2);
    });

    it('should pass abort signal to parallel executor', async () => {
      const testCases = [createMockTestCase('1', 'Test 1')];
      const abortController = new AbortController();

      vi.mocked(executeTestsInParallel).mockResolvedValue({
        results: [createMockExecutionResult(testCases[0])],
        aborted: false,
      });

      const callbacks = createMockCallbacks();
      const params = createBaseParams(testCases, { parallelExecution: true });

      await executeTestSuiteWithStreaming(params, callbacks, abortController.signal);

      expect(executeTestsInParallel).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          abortSignal: abortController.signal,
        })
      );
    });
  });
});
