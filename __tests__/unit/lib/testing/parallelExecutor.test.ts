import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { executeTestsInParallel } from '@/lib/testing/parallelExecutor';
import { ITestCase } from '@/lib/db/models/testSuite';
import { TestCaseExecutionResult } from '@/lib/testing/executor';

// Helper to create a mock test case
function createMockTestCase(id: string, name: string): ITestCase {
  return {
    _id: new mongoose.Types.ObjectId(id.padStart(24, '0')),
    name,
    inputs: { query: `test input for ${name}` },
    enabled: true,
  } as ITestCase;
}

// Helper to create a mock execution result
function createMockResult(testCase: ITestCase, delay: number = 0): TestCaseExecutionResult {
  return {
    testCaseId: testCase._id,
    testCaseName: testCase.name,
    inputs: testCase.inputs,
    output: `output for ${testCase.name}`,
    validationPassed: true,
    validationErrors: [],
    responseTime: delay,
  };
}

describe('executeTestsInParallel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic execution', () => {
    it('should execute all test cases and return results', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const executeFn = vi.fn().mockImplementation((tc: ITestCase) =>
        Promise.resolve(createMockResult(tc))
      );

      const { results, aborted } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5 }
      );

      expect(aborted).toBe(false);
      expect(results).toHaveLength(3);
      expect(executeFn).toHaveBeenCalledTimes(3);
    });

    it('should preserve order of results matching input test cases', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      // Simulate varying execution times - Test 2 finishes first, Test 1 last
      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        const delays: Record<string, number> = {
          'Test 1': 30,
          'Test 2': 10,
          'Test 3': 20,
        };
        await new Promise(resolve => setTimeout(resolve, delays[tc.name]));
        return createMockResult(tc, delays[tc.name]);
      });

      const { results } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5 }
      );

      // Results should be in original order despite different completion times
      expect(results[0].testCaseName).toBe('Test 1');
      expect(results[1].testCaseName).toBe('Test 2');
      expect(results[2].testCaseName).toBe('Test 3');
    });

    it('should handle empty test cases array', async () => {
      const executeFn = vi.fn();

      const { results, aborted } = await executeTestsInParallel(
        [],
        executeFn,
        { maxConcurrency: 5 }
      );

      expect(aborted).toBe(false);
      expect(results).toHaveLength(0);
      expect(executeFn).not.toHaveBeenCalled();
    });
  });

  describe('concurrency control', () => {
    it('should limit concurrent executions to maxConcurrency', async () => {
      const testCases = Array.from({ length: 10 }, (_, i) =>
        createMockTestCase(String(i + 1), `Test ${i + 1}`)
      );

      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 20));

        currentConcurrency--;
        return createMockResult(tc);
      });

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 3 }
      );

      expect(maxObservedConcurrency).toBeLessThanOrEqual(3);
      expect(executeFn).toHaveBeenCalledTimes(10);
    });

    it('should handle maxConcurrency of 1 (sequential)', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const executionOrder: string[] = [];
      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        executionOrder.push(`start-${tc.name}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(`end-${tc.name}`);
        return createMockResult(tc);
      });

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 1 }
      );

      // With concurrency of 1, executions should not overlap
      // Each test should complete before the next starts
      expect(executionOrder).toEqual([
        'start-Test 1', 'end-Test 1',
        'start-Test 2', 'end-Test 2',
        'start-Test 3', 'end-Test 3',
      ]);
    });

    it('should allow high concurrency when maxConcurrency exceeds test count', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrency--;
        return createMockResult(tc);
      });

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 10 }
      );

      // All 3 tests should run concurrently
      expect(maxObservedConcurrency).toBe(3);
    });
  });

  describe('abort signal', () => {
    it('should stop execution when abort signal is triggered before start', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      const abortController = new AbortController();
      abortController.abort(); // Abort immediately

      const executeFn = vi.fn().mockResolvedValue(createMockResult(testCases[0]));

      const { results, aborted } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, abortSignal: abortController.signal }
      );

      expect(aborted).toBe(true);
      expect(results).toHaveLength(0);
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('should stop execution when abort signal is triggered during execution', async () => {
      const testCases = Array.from({ length: 10 }, (_, i) =>
        createMockTestCase(String(i + 1), `Test ${i + 1}`)
      );

      const abortController = new AbortController();
      let executionCount = 0;

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        executionCount++;
        // Abort after 3 executions start
        if (executionCount === 3) {
          abortController.abort();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        return createMockResult(tc);
      });

      const { aborted } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 2, abortSignal: abortController.signal }
      );

      expect(aborted).toBe(true);
      // Not all 10 tests should have executed
      expect(executeFn.mock.calls.length).toBeLessThan(10);
    });
  });

  describe('error handling', () => {
    it('should capture errors and create error results', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        if (tc.name === 'Test 2') {
          throw new Error('Execution failed for Test 2');
        }
        return createMockResult(tc);
      });

      const { results, aborted } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5 }
      );

      expect(aborted).toBe(false);
      expect(results).toHaveLength(3);

      // Test 1 and 3 should pass
      expect(results[0].validationPassed).toBe(true);
      expect(results[2].validationPassed).toBe(true);

      // Test 2 should have error
      expect(results[1].validationPassed).toBe(false);
      expect(results[1].error).toBe('Execution failed for Test 2');
      expect(results[1].validationErrors).toContain('Execution failed for Test 2');
    });

    it('should continue execution after errors', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        if (tc.name === 'Test 1') {
          throw new Error('First test failed');
        }
        return createMockResult(tc);
      });

      const { results } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 1 } // Sequential to ensure order
      );

      // All tests should have results
      expect(results).toHaveLength(3);
      expect(executeFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('callbacks', () => {
    it('should call onProgress for each test case', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
        createMockTestCase('3', 'Test 3'),
      ];

      const onProgress = vi.fn();
      const executeFn = vi.fn().mockImplementation((tc: ITestCase) =>
        Promise.resolve(createMockResult(tc))
      );

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, onProgress }
      );

      expect(onProgress).toHaveBeenCalledTimes(3);

      // Check that all test cases were reported
      const reportedNames = onProgress.mock.calls.map(call => call[1].name);
      expect(reportedNames).toContain('Test 1');
      expect(reportedNames).toContain('Test 2');
      expect(reportedNames).toContain('Test 3');
    });

    it('should call onResult for each completed test', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
        createMockTestCase('2', 'Test 2'),
      ];

      const onResult = vi.fn();
      const executeFn = vi.fn().mockImplementation((tc: ITestCase) =>
        Promise.resolve(createMockResult(tc))
      );

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, onResult }
      );

      expect(onResult).toHaveBeenCalledTimes(2);

      // Check result structure
      const firstResult = onResult.mock.calls[0][0];
      expect(firstResult).toHaveProperty('testCaseName');
      expect(firstResult).toHaveProperty('output');
      expect(firstResult).toHaveProperty('validationPassed');
    });

    it('should call onResult even for failed tests', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
      ];

      const onResult = vi.fn();
      const executeFn = vi.fn().mockRejectedValue(new Error('Test failed'));

      await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, onResult }
      );

      expect(onResult).toHaveBeenCalledTimes(1);
      const result = onResult.mock.calls[0][0];
      expect(result.validationPassed).toBe(false);
      expect(result.error).toBe('Test failed');
    });

    it('should not fail if onProgress callback throws', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
      ];

      const onProgress = vi.fn().mockRejectedValue(new Error('Callback error'));
      const executeFn = vi.fn().mockImplementation((tc: ITestCase) =>
        Promise.resolve(createMockResult(tc))
      );

      // Should not throw
      const { results } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, onProgress }
      );

      expect(results).toHaveLength(1);
    });

    it('should not fail if onResult callback throws', async () => {
      const testCases = [
        createMockTestCase('1', 'Test 1'),
      ];

      const onResult = vi.fn().mockRejectedValue(new Error('Callback error'));
      const executeFn = vi.fn().mockImplementation((tc: ITestCase) =>
        Promise.resolve(createMockResult(tc))
      );

      // Should not throw
      const { results } = await executeTestsInParallel(
        testCases,
        executeFn,
        { maxConcurrency: 5, onResult }
      );

      expect(results).toHaveLength(1);
    });
  });

  describe('performance', () => {
    it('should execute faster with parallel than sequential', async () => {
      const testCases = Array.from({ length: 5 }, (_, i) =>
        createMockTestCase(String(i + 1), `Test ${i + 1}`)
      );

      const executeFn = vi.fn().mockImplementation(async (tc: ITestCase) => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return createMockResult(tc);
      });

      // Parallel execution (5 concurrent)
      const parallelStart = Date.now();
      await executeTestsInParallel(testCases, executeFn, { maxConcurrency: 5 });
      const parallelTime = Date.now() - parallelStart;

      executeFn.mockClear();

      // Sequential execution (1 concurrent)
      const sequentialStart = Date.now();
      await executeTestsInParallel(testCases, executeFn, { maxConcurrency: 1 });
      const sequentialTime = Date.now() - sequentialStart;

      // Parallel should be significantly faster
      // 5 tests × 20ms = 100ms sequential vs ~20ms parallel
      expect(parallelTime).toBeLessThan(sequentialTime);
    });
  });
});