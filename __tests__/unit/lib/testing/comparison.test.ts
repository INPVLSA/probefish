import { describe, it, expect } from 'vitest';

/**
 * Tests for test run comparison logic.
 * These test the core comparison algorithms used by the compare API endpoint.
 */

interface TestResult {
  testCaseId: string;
  testCaseName: string;
  validationPassed: boolean;
  judgeScore?: number;
  responseTime: number;
  validationErrors: string[];
}

interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  avgScore?: number;
  avgResponseTime: number;
}

interface TestRun {
  _id: string;
  runAt: Date;
  status: string;
  results: TestResult[];
  summary: TestRunSummary;
}

type ComparisonStatus = 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed';

interface TestCaseComparison {
  testCaseId: string;
  testCaseName: string;
  status: ComparisonStatus;
  scoreDelta?: number;
  responseTimeDelta?: number;
}

// Core comparison logic extracted for testing
function compareTestRuns(baselineRun: TestRun, compareRun: TestRun) {
  const baselineResultsMap = new Map(
    baselineRun.results.map((r) => [r.testCaseId, r])
  );
  const compareResultsMap = new Map(
    compareRun.results.map((r) => [r.testCaseId, r])
  );

  const allTestCaseIds = new Set([
    ...baselineResultsMap.keys(),
    ...compareResultsMap.keys(),
  ]);

  const testCases: TestCaseComparison[] = [];
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  let newTests = 0;
  let removed = 0;

  for (const testCaseId of allTestCaseIds) {
    const baselineResult = baselineResultsMap.get(testCaseId);
    const compareResult = compareResultsMap.get(testCaseId);

    const comparison: TestCaseComparison = {
      testCaseId,
      testCaseName: compareResult?.testCaseName || baselineResult?.testCaseName || 'Unknown',
      status: 'unchanged',
    };

    if (!baselineResult && compareResult) {
      comparison.status = 'new';
      newTests++;
    } else if (baselineResult && !compareResult) {
      comparison.status = 'removed';
      removed++;
    } else if (baselineResult && compareResult) {
      const baselinePassed = baselineResult.validationPassed;
      const comparePassed = compareResult.validationPassed;

      if (baselineResult.judgeScore !== undefined && compareResult.judgeScore !== undefined) {
        comparison.scoreDelta = compareResult.judgeScore - baselineResult.judgeScore;
      }
      comparison.responseTimeDelta = compareResult.responseTime - baselineResult.responseTime;

      if (!baselinePassed && comparePassed) {
        comparison.status = 'improved';
        improved++;
      } else if (baselinePassed && !comparePassed) {
        comparison.status = 'regressed';
        regressed++;
      } else if (comparison.scoreDelta !== undefined && Math.abs(comparison.scoreDelta) > 0.05) {
        if (comparison.scoreDelta > 0) {
          comparison.status = 'improved';
          improved++;
        } else {
          comparison.status = 'regressed';
          regressed++;
        }
      } else {
        comparison.status = 'unchanged';
        unchanged++;
      }
    }

    testCases.push(comparison);
  }

  const baselinePassRate = baselineRun.summary.total > 0
    ? (baselineRun.summary.passed / baselineRun.summary.total) * 100
    : 0;
  const comparePassRate = compareRun.summary.total > 0
    ? (compareRun.summary.passed / compareRun.summary.total) * 100
    : 0;

  return {
    summary: {
      improved,
      regressed,
      unchanged,
      new: newTests,
      removed,
      passRateDelta: Math.round((comparePassRate - baselinePassRate) * 10) / 10,
      avgScoreDelta:
        baselineRun.summary.avgScore !== undefined && compareRun.summary.avgScore !== undefined
          ? Math.round((compareRun.summary.avgScore - baselineRun.summary.avgScore) * 1000) / 10
          : undefined,
      avgResponseTimeDelta: compareRun.summary.avgResponseTime - baselineRun.summary.avgResponseTime,
    },
    testCases,
  };
}

describe('Test Run Comparison', () => {
  describe('status determination', () => {
    it('should detect regression when test goes from pass to fail', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: false, responseTime: 100, validationErrors: ['Failed'] },
        ],
        summary: { total: 1, passed: 0, failed: 1, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.regressed).toBe(1);
      expect(result.summary.improved).toBe(0);
      expect(result.testCases[0].status).toBe('regressed');
    });

    it('should detect improvement when test goes from fail to pass', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: false, responseTime: 100, validationErrors: ['Error'] },
        ],
        summary: { total: 1, passed: 0, failed: 1, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.improved).toBe(1);
      expect(result.summary.regressed).toBe(0);
      expect(result.testCases[0].status).toBe('improved');
    });

    it('should detect unchanged when both pass', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.unchanged).toBe(1);
      expect(result.testCases[0].status).toBe('unchanged');
    });

    it('should detect new test case', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [],
        summary: { total: 0, passed: 0, failed: 0, avgResponseTime: 0 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'New Test', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.new).toBe(1);
      expect(result.testCases[0].status).toBe('new');
    });

    it('should detect removed test case', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Removed Test', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 0 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [],
        summary: { total: 0, passed: 0, failed: 0, avgResponseTime: 0 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.removed).toBe(1);
      expect(result.testCases[0].status).toBe('removed');
    });
  });

  describe('score-based comparison', () => {
    it('should detect improvement when score increases by more than 5%', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.6, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.6, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.8, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.8, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.improved).toBe(1);
      expect(result.testCases[0].status).toBe('improved');
      expect(result.testCases[0].scoreDelta).toBeCloseTo(0.2);
    });

    it('should detect regression when score decreases by more than 5%', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.9, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.9, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.7, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.7, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.regressed).toBe(1);
      expect(result.testCases[0].status).toBe('regressed');
      expect(result.testCases[0].scoreDelta).toBeCloseTo(-0.2);
    });

    it('should remain unchanged when score change is within 5%', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.8, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.8, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.82, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.82, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.unchanged).toBe(1);
      expect(result.testCases[0].status).toBe('unchanged');
    });
  });

  describe('delta calculations', () => {
    it('should calculate pass rate delta correctly', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: false, responseTime: 100, validationErrors: ['Error'] },
        ],
        summary: { total: 2, passed: 1, failed: 1, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 2, passed: 2, failed: 0, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      // 50% -> 100% = +50%
      expect(result.summary.passRateDelta).toBe(50);
    });

    it('should calculate negative pass rate delta', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 2, passed: 2, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: false, responseTime: 100, validationErrors: ['Error'] },
        ],
        summary: { total: 2, passed: 1, failed: 1, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      // 100% -> 50% = -50%
      expect(result.summary.passRateDelta).toBe(-50);
    });

    it('should calculate response time delta', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 150, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 150 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.avgResponseTimeDelta).toBe(50);
      expect(result.testCases[0].responseTimeDelta).toBe(50);
    });

    it('should calculate avg score delta', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.7, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.7, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.85, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.85, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      // (0.85 - 0.7) * 1000 / 10 = 15%
      expect(result.summary.avgScoreDelta).toBe(15);
    });
  });

  describe('mixed scenarios', () => {
    it('should handle multiple test cases with different statuses', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Stays Pass', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Will Fail', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc3', testCaseName: 'Will Pass', validationPassed: false, responseTime: 100, validationErrors: ['Error'] },
          { testCaseId: 'tc4', testCaseName: 'Will Be Removed', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 4, passed: 3, failed: 1, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Stays Pass', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Will Fail', validationPassed: false, responseTime: 100, validationErrors: ['Error'] },
          { testCaseId: 'tc3', testCaseName: 'Will Pass', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc5', testCaseName: 'New Test', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 4, passed: 3, failed: 1, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.unchanged).toBe(1);  // tc1
      expect(result.summary.regressed).toBe(1);  // tc2
      expect(result.summary.improved).toBe(1);   // tc3
      expect(result.summary.removed).toBe(1);    // tc4
      expect(result.summary.new).toBe(1);        // tc5
      expect(result.testCases).toHaveLength(5);
    });

    it('should handle empty baseline run', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [],
        summary: { total: 0, passed: 0, failed: 0, avgResponseTime: 0 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 2, passed: 2, failed: 0, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.new).toBe(2);
      expect(result.summary.passRateDelta).toBe(100);
    });

    it('should handle empty compare run', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
          { testCaseId: 'tc2', testCaseName: 'Test 2', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 2, passed: 2, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [],
        summary: { total: 0, passed: 0, failed: 0, avgResponseTime: 0 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.removed).toBe(2);
      expect(result.summary.passRateDelta).toBe(-100);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined avgScore in one run', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.8, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.8, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.avgScoreDelta).toBeUndefined();
    });

    it('should handle both runs with all tests failing', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: false, responseTime: 100, validationErrors: ['Error 1'] },
        ],
        summary: { total: 1, passed: 0, failed: 1, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: false, responseTime: 100, validationErrors: ['Error 2'] },
        ],
        summary: { total: 1, passed: 0, failed: 1, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.passRateDelta).toBe(0);
    });

    it('should handle score at exactly 5% threshold', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.8, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.8, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.85, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.85, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      // Exactly 5% should NOT trigger change (>0.05 required)
      expect(result.summary.unchanged).toBe(1);
    });

    it('should handle score just over 5% threshold', () => {
      const baseline: TestRun = {
        _id: 'run1',
        runAt: new Date('2025-01-01'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.8, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.8, avgResponseTime: 100 },
      };

      const compare: TestRun = {
        _id: 'run2',
        runAt: new Date('2025-01-02'),
        status: 'completed',
        results: [
          { testCaseId: 'tc1', testCaseName: 'Test 1', validationPassed: true, judgeScore: 0.851, responseTime: 100, validationErrors: [] },
        ],
        summary: { total: 1, passed: 1, failed: 0, avgScore: 0.851, avgResponseTime: 100 },
      };

      const result = compareTestRuns(baseline, compare);

      // Just over 5% should trigger improvement
      expect(result.summary.improved).toBe(1);
    });
  });
});
