import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// Mock the dependencies
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/authorization', () => ({
  requireProjectPermission: vi.fn(),
  authError: vi.fn((auth) => new Response(JSON.stringify({ error: auth.error }), { status: 401 })),
}));

vi.mock('@/lib/db/models/testSuite', () => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockMarkModified = vi.fn();

  return {
    default: {
      findOne: vi.fn(),
    },
    __mockSave: mockSave,
    __mockMarkModified: mockMarkModified,
  };
});

import { GET, POST } from '@/app/api/projects/[projectId]/test-suites/[suiteId]/comparison-sessions/route';
import { requireProjectPermission } from '@/lib/auth/authorization';
import TestSuite from '@/lib/db/models/testSuite';

describe('Comparison Sessions API', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockSuiteId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/projects/[projectId]/test-suites/[suiteId]/comparison-sessions', () => {
    it('should return 401 if not authorized', async () => {
      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions');
      const response = await GET(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 if test suite not found', async () => {
      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions');
      const response = await GET(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Test suite not found');
    });

    it('should return empty sessions array if no sessions exist', async () => {
      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue({
        _id: mockSuiteId,
        comparisonSessions: [],
      });

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions');
      const response = await GET(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toEqual([]);
    });

    it('should return existing comparison sessions', async () => {
      const mockSessions = [
        {
          _id: new mongoose.Types.ObjectId(),
          runAt: new Date(),
          runBy: new mongoose.Types.ObjectId(),
          models: [{ provider: 'openai', model: 'gpt-4o' }],
          runs: [],
        },
      ];

      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue({
        _id: mockSuiteId,
        comparisonSessions: mockSessions,
      });

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions');
      const response = await GET(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(1);
    });
  });

  describe('POST /api/projects/[projectId]/test-suites/[suiteId]/comparison-sessions', () => {
    it('should return 400 if models array is missing', async () => {
      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue({
        _id: mockSuiteId,
        comparisonSessions: [],
        save: vi.fn(),
        markModified: vi.fn(),
      });

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions', {
        method: 'POST',
        body: JSON.stringify({ runs: [] }),
      });
      const response = await POST(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Models array is required');
    });

    it('should return 400 if runs array is missing', async () => {
      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue({
        _id: mockSuiteId,
        comparisonSessions: [],
        save: vi.fn(),
        markModified: vi.fn(),
      });

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions', {
        method: 'POST',
        body: JSON.stringify({ models: [{ provider: 'openai', model: 'gpt-4o' }] }),
      });
      const response = await POST(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Runs array is required');
    });

    it('should create a new comparison session', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockMarkModified = vi.fn();

      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue({
        _id: mockSuiteId,
        comparisonSessions: [],
        save: mockSave,
        markModified: mockMarkModified,
      });

      const requestBody = {
        models: [
          { provider: 'openai', model: 'gpt-4o', isPrimary: true },
          { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        ],
        runs: [
          {
            status: 'completed',
            modelOverride: { provider: 'openai', model: 'gpt-4o' },
            results: [],
            summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 1000 },
          },
          {
            status: 'completed',
            modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
            results: [],
            summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 1500 },
          },
        ],
      };

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session).toBeDefined();
      expect(data.session.models).toHaveLength(2);
      expect(data.session.runs).toHaveLength(2);
      expect(mockSave).toHaveBeenCalled();
      expect(mockMarkModified).toHaveBeenCalledWith('comparisonSessions');
    });

    it('should limit comparison sessions to 20', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockMarkModified = vi.fn();

      // Create 20 existing sessions
      const existingSessions = Array(20).fill(null).map(() => ({
        _id: new mongoose.Types.ObjectId(),
        runAt: new Date(),
        runBy: new mongoose.Types.ObjectId(),
        models: [],
        runs: [],
      }));

      const testSuite = {
        _id: mockSuiteId,
        comparisonSessions: existingSessions,
        save: mockSave,
        markModified: mockMarkModified,
      };

      vi.mocked(requireProjectPermission).mockResolvedValue({
        authorized: true,
        context: { user: { id: mockUserId } },
      });
      vi.mocked(TestSuite.findOne).mockResolvedValue(testSuite);

      const requestBody = {
        models: [{ provider: 'openai', model: 'gpt-4o' }],
        runs: [{
          status: 'completed',
          modelOverride: { provider: 'openai', model: 'gpt-4o' },
          results: [],
          summary: { total: 1, passed: 1, failed: 0, avgResponseTime: 1000 },
        }],
      };

      const request = new NextRequest('http://localhost/api/projects/test/test-suites/test/comparison-sessions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request, { params: Promise.resolve({ projectId: mockProjectId, suiteId: mockSuiteId }) });

      // Should have been trimmed to 20
      expect(testSuite.comparisonSessions.length).toBe(20);
    });
  });
});
