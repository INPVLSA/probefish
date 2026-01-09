import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// Mock the dependencies
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/authorization', () => ({
  requireProjectPermission: vi.fn(),
  authError: vi.fn((auth) => {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
    });
  }),
}));

vi.mock('@/lib/db/models/project', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/organization', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/testSuite', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/prompt', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/endpoint', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/testing', () => ({
  executeTestCase: vi.fn(),
  toTestResult: vi.fn((result) => result),
}));

vi.mock('@/lib/utils/encryption', () => ({
  decrypt: vi.fn((value) => `decrypted-${value}`),
}));

vi.mock('@/lib/webhooks/dispatcher', () => ({
  dispatchWebhooks: vi.fn(() => Promise.resolve()),
}));

import { POST } from '@/app/api/projects/[projectId]/test-suites/[suiteId]/run/route';
import { requireProjectPermission } from '@/lib/auth/authorization';
import Project from '@/lib/db/models/project';
import Organization from '@/lib/db/models/organization';
import TestSuite from '@/lib/db/models/testSuite';
import Prompt from '@/lib/db/models/prompt';
import Endpoint from '@/lib/db/models/endpoint';
import { executeTestCase } from '@/lib/testing';

describe('Test Suite Run API - POST /api/projects/[projectId]/test-suites/[suiteId]/run', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();
  const mockSuiteId = new mongoose.Types.ObjectId();
  const mockPromptId = new mongoose.Types.ObjectId();
  const mockEndpointId = new mongoose.Types.ObjectId();

  const mockTestCase1Id = new mongoose.Types.ObjectId();
  const mockTestCase2Id = new mongoose.Types.ObjectId();
  const mockTestCase3Id = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (overrides: {
    testSuite?: Partial<ReturnType<typeof createMockTestSuite>>;
    organization?: Record<string, unknown>;
    prompt?: Record<string, unknown>;
    endpoint?: Record<string, unknown>;
    authorized?: boolean;
  } = {}) => {
    const mockSave = vi.fn().mockResolvedValue(undefined);

    // Auth mock
    vi.mocked(requireProjectPermission).mockResolvedValue(
      overrides.authorized === false
        ? { authorized: false, error: 'Unauthorized', status: 401 }
        : {
            authorized: true,
            context: {
              user: { id: mockUserId.toString() },
              project: { id: mockProjectId.toString() },
            },
          }
    );

    // Project mock
    vi.mocked(Project.findById).mockResolvedValue({
      _id: mockProjectId,
      name: 'Test Project',
      organizationId: mockOrgId,
    });

    // Organization mock with API keys
    vi.mocked(Organization.findById).mockResolvedValue({
      _id: mockOrgId,
      llmCredentials: {
        openai: { apiKey: 'encrypted-openai-key' },
        anthropic: { apiKey: 'encrypted-anthropic-key' },
        gemini: { apiKey: 'encrypted-gemini-key' },
      },
      ...overrides.organization,
    });

    const testSuite = createMockTestSuite(mockSave, overrides.testSuite);
    vi.mocked(TestSuite.findOne).mockResolvedValue(testSuite);

    // Prompt mock
    vi.mocked(Prompt.findById).mockResolvedValue({
      _id: mockPromptId,
      name: 'Test Prompt',
      currentVersion: 1,
      versions: [
        {
          version: 1,
          content: 'Hello {{name}}',
          variables: ['name'],
          modelConfig: { provider: 'openai', model: 'gpt-4o' },
        },
      ],
      ...overrides.prompt,
    });

    // Endpoint mock
    vi.mocked(Endpoint.findById).mockResolvedValue({
      _id: mockEndpointId,
      name: 'Test Endpoint',
      url: 'https://api.example.com',
      method: 'POST',
      variables: ['input'],
      ...overrides.endpoint,
    });

    // Execute test case mock - returns successful result
    vi.mocked(executeTestCase).mockResolvedValue({
      testCaseId: mockTestCase1Id.toString(),
      testCaseName: 'Test Case 1',
      inputs: { name: 'World' },
      output: 'Hello World!',
      validationPassed: true,
      validationErrors: [],
      responseTime: 100,
    });

    return { mockSave, testSuite };
  };

  const createMockTestSuite = (
    mockSave: ReturnType<typeof vi.fn>,
    overrides: Partial<ReturnType<typeof createMockTestSuite>> = {}
  ) => ({
    _id: mockSuiteId,
    projectId: mockProjectId,
    organizationId: mockOrgId,
    name: 'Test Suite',
    targetType: 'prompt' as const,
    targetId: mockPromptId,
    targetVersion: 1,
    testCases: [
      { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' }, tags: ['smoke'] },
      { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' }, tags: ['regression'] },
      { _id: mockTestCase3Id, name: 'Test Case 3', inputs: { name: 'Admin' }, tags: ['smoke', 'auth'] },
    ],
    validationRules: [],
    llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
    runHistory: [],
    save: mockSave,
    markModified: vi.fn(),
    ...overrides,
  });

  const createRequest = (body: Record<string, unknown> = {}) => {
    return new NextRequest(
      `http://localhost/api/projects/${mockProjectId}/test-suites/${mockSuiteId}/run`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  };

  const callRoute = async (body: Record<string, unknown> = {}) => {
    const request = createRequest(body);
    return POST(request, {
      params: Promise.resolve({
        projectId: mockProjectId.toString(),
        suiteId: mockSuiteId.toString(),
      }),
    });
  };

  describe('Authorization', () => {
    it('should return 401 when user is not authorized', async () => {
      setupMocks({ authorized: false });

      const response = await callRoute();

      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should return 404 when project is not found', async () => {
      setupMocks();
      vi.mocked(Project.findById).mockResolvedValue(null);

      const response = await callRoute();

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Project not found');
    });

    it('should return 404 when test suite is not found', async () => {
      setupMocks();
      vi.mocked(TestSuite.findOne).mockResolvedValue(null);

      const response = await callRoute();

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Test suite not found');
    });

    it('should return 400 when test suite has no test cases', async () => {
      setupMocks({ testSuite: { testCases: [] } });

      const response = await callRoute();

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Test suite has no test cases');
    });
  });

  describe('Running all test cases', () => {
    it('should run all test cases when no filters provided', async () => {
      const { mockSave } = setupMocks();

      const response = await callRoute();

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(3);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should return success with test run results', async () => {
      setupMocks();

      const response = await callRoute();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.testRun).toBeDefined();
      expect(data.testRun.status).toBe('completed');
      expect(data.testRun.summary.total).toBe(3);
    });
  });

  describe('Filtering by testCaseIds', () => {
    it('should run only specified test cases when testCaseIds provided', async () => {
      setupMocks();

      const response = await callRoute({
        testCaseIds: [mockTestCase1Id.toString()],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(1);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(1);
    });

    it('should run multiple specified test cases', async () => {
      setupMocks();

      const response = await callRoute({
        testCaseIds: [mockTestCase1Id.toString(), mockTestCase3Id.toString()],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(2);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(2);
    });

    it('should return 400 when no test cases match the provided IDs', async () => {
      setupMocks();

      const response = await callRoute({
        testCaseIds: [new mongoose.Types.ObjectId().toString()],
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No test cases match the selected IDs');
    });

    it('should ignore invalid testCaseIds (non-string values)', async () => {
      setupMocks();

      const response = await callRoute({
        testCaseIds: [mockTestCase1Id.toString(), 123, null, undefined, ''],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(1);
    });

    it('testCaseIds should take precedence over tags filter', async () => {
      setupMocks();

      // testCase1 has 'smoke' tag, testCase2 has 'regression' tag
      // If we specify testCase2 ID but filter by 'smoke' tag,
      // testCaseIds should win and only run testCase2
      const response = await callRoute({
        testCaseIds: [mockTestCase2Id.toString()],
        tags: ['smoke'],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(1);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(1);
    });
  });

  describe('Filtering by tags', () => {
    it('should filter test cases by single tag', async () => {
      setupMocks();

      const response = await callRoute({
        tags: ['regression'],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(1);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(1);
    });

    it('should filter test cases by multiple tags (OR logic)', async () => {
      setupMocks();

      // 'smoke' tag: testCase1, testCase3
      // 'regression' tag: testCase2
      // Total with OR logic: 3
      const response = await callRoute({
        tags: ['smoke', 'regression'],
      });

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(3);
    });

    it('should return 400 when no test cases match the selected tags', async () => {
      setupMocks();

      const response = await callRoute({
        tags: ['nonexistent-tag'],
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No test cases match the selected tags');
    });
  });

  describe('Iterations', () => {
    it('should run test cases multiple times when iterations > 1', async () => {
      setupMocks();

      const response = await callRoute({
        iterations: 3,
      });

      expect(response.status).toBe(200);
      // 3 test cases * 3 iterations = 9 executions
      expect(executeTestCase).toHaveBeenCalledTimes(9);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(9);
    });

    it('should cap iterations at 100', async () => {
      setupMocks();

      const response = await callRoute({
        iterations: 200,
      });

      expect(response.status).toBe(200);
      // 3 test cases * 100 iterations = 300 executions
      expect(executeTestCase).toHaveBeenCalledTimes(300);
    });

    it('should default to 1 iteration when not specified', async () => {
      setupMocks();

      const response = await callRoute({});

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(3);
    });
  });

  describe('Run note', () => {
    it('should include note in test run when provided', async () => {
      setupMocks();

      const response = await callRoute({
        note: 'Testing new feature',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.testRun.note).toBe('Testing new feature');
    });

    it('should truncate note to 500 characters', async () => {
      setupMocks();

      const longNote = 'a'.repeat(600);
      const response = await callRoute({
        note: longNote,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.testRun.note).toHaveLength(500);
    });
  });

  describe('Model override', () => {
    it('should pass model override to executeTestCase', async () => {
      setupMocks();

      await callRoute({
        modelOverride: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
        },
      });

      expect(executeTestCase).toHaveBeenCalledWith(
        expect.objectContaining({
          modelOverride: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
          },
        })
      );
    });
  });

  describe('Endpoint testing', () => {
    it('should run endpoint test cases', async () => {
      setupMocks({
        testSuite: {
          targetType: 'endpoint',
          targetId: mockEndpointId,
        },
      });

      const response = await callRoute();

      expect(response.status).toBe(200);
      expect(executeTestCase).toHaveBeenCalledTimes(3);
      expect(Endpoint.findById).toHaveBeenCalled();
    });
  });

  describe('Run history', () => {
    it('should add new run to run history', async () => {
      const { testSuite } = setupMocks();

      await callRoute();

      expect(testSuite.runHistory.length).toBe(1);
      expect(testSuite.lastRun).toBeDefined();
    });

    it('should keep only last 10 runs in history', async () => {
      const existingRuns = Array.from({ length: 10 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        runAt: new Date(Date.now() - i * 1000),
        status: 'completed',
        results: [],
        summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 100 },
      }));

      const { testSuite } = setupMocks({
        testSuite: { runHistory: existingRuns },
      });

      await callRoute();

      expect(testSuite.runHistory.length).toBe(10);
    });
  });

  describe('Combined filters: testCaseIds with iterations', () => {
    it('should run specific test cases multiple times', async () => {
      setupMocks();

      const response = await callRoute({
        testCaseIds: [mockTestCase1Id.toString(), mockTestCase2Id.toString()],
        iterations: 2,
      });

      expect(response.status).toBe(200);
      // 2 test cases * 2 iterations = 4 executions
      expect(executeTestCase).toHaveBeenCalledTimes(4);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(4);
    });
  });

  describe('Filtering by enabled status', () => {
    it('should skip disabled test cases', async () => {
      setupMocks({
        testSuite: {
          testCases: [
            { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' }, tags: ['smoke'], enabled: true },
            { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' }, tags: ['regression'], enabled: false },
            { _id: mockTestCase3Id, name: 'Test Case 3', inputs: { name: 'Admin' }, tags: ['smoke', 'auth'] },
          ],
        },
      });

      const response = await callRoute();

      expect(response.status).toBe(200);
      // Only 2 enabled test cases should run (testCase1 and testCase3)
      expect(executeTestCase).toHaveBeenCalledTimes(2);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(2);
    });

    it('should return 400 when all test cases are disabled', async () => {
      setupMocks({
        testSuite: {
          testCases: [
            { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' }, enabled: false },
            { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' }, enabled: false },
          ],
        },
      });

      const response = await callRoute();

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No enabled test cases to run');
    });

    it('should apply enabled filter after testCaseIds filter', async () => {
      setupMocks({
        testSuite: {
          testCases: [
            { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' }, enabled: false },
            { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' }, enabled: true },
            { _id: mockTestCase3Id, name: 'Test Case 3', inputs: { name: 'Admin' }, enabled: true },
          ],
        },
      });

      const response = await callRoute({
        testCaseIds: [mockTestCase1Id.toString(), mockTestCase2Id.toString()],
      });

      expect(response.status).toBe(200);
      // Only testCase2 should run (testCase1 is disabled)
      expect(executeTestCase).toHaveBeenCalledTimes(1);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(1);
    });

    it('should apply enabled filter after tags filter', async () => {
      setupMocks({
        testSuite: {
          testCases: [
            { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' }, tags: ['smoke'], enabled: false },
            { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' }, tags: ['smoke'], enabled: true },
            { _id: mockTestCase3Id, name: 'Test Case 3', inputs: { name: 'Admin' }, tags: ['regression'], enabled: true },
          ],
        },
      });

      const response = await callRoute({
        tags: ['smoke'],
      });

      expect(response.status).toBe(200);
      // Only testCase2 should run (testCase1 has smoke tag but is disabled)
      expect(executeTestCase).toHaveBeenCalledTimes(1);

      const data = await response.json();
      expect(data.testRun.summary.total).toBe(1);
    });

    it('should treat undefined enabled as true (enabled by default)', async () => {
      setupMocks({
        testSuite: {
          testCases: [
            { _id: mockTestCase1Id, name: 'Test Case 1', inputs: { name: 'World' } },
            { _id: mockTestCase2Id, name: 'Test Case 2', inputs: { name: 'User' } },
          ],
        },
      });

      const response = await callRoute();

      expect(response.status).toBe(200);
      // Both test cases should run (enabled is undefined, treated as true)
      expect(executeTestCase).toHaveBeenCalledTimes(2);
    });
  });
});
