import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// Mock dependencies before importing
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/authorization', () => ({
  requireProjectPermission: vi.fn(),
  authError: vi.fn((result) => {
    return new Response(JSON.stringify({ error: result.error?.message }), {
      status: result.error?.status || 401,
    });
  }),
}));

vi.mock('@/lib/db/models/project', () => ({
  default: {
    findById: vi.fn(),
  },
}));

const mockTestSuiteSave = vi.fn().mockResolvedValue(undefined);
const mockTestSuiteConstructor = vi.fn();
vi.mock('@/lib/db/models/testSuite', () => {
  const MockTestSuite = function(this: Record<string, unknown>, data: Record<string, unknown>) {
    mockTestSuiteConstructor(data);
    Object.assign(this, data);
    this._id = new mongoose.Types.ObjectId();
    this.save = mockTestSuiteSave;
    return this;
  } as unknown as typeof import('@/lib/db/models/testSuite').default;
  MockTestSuite.findOne = vi.fn();
  return {
    default: MockTestSuite,
  };
});

vi.mock('@/lib/utils/slug', () => ({
  generateSlug: vi.fn((name) => name.toLowerCase().replace(/\s+/g, '-')),
  ensureUniqueSlug: vi.fn(async (slug) => slug),
}));

import { POST } from '@/app/api/projects/[projectId]/test-suites/route';
import { requireProjectPermission } from '@/lib/auth/authorization';
import Project from '@/lib/db/models/project';
import TestSuite from '@/lib/db/models/testSuite';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';

describe('Test Suites API - POST /api/projects/[projectId]/test-suites', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();
  const mockPromptId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTestSuiteConstructor.mockClear();
    mockTestSuiteSave.mockClear();
  });

  const setupMocks = (overrides: {
    authorized?: boolean;
    projectExists?: boolean;
  } = {}) => {
    const { authorized = true, projectExists = true } = overrides;

    vi.mocked(requireProjectPermission).mockResolvedValue(
      authorized
        ? {
            authorized: true,
            context: {
              authType: 'session' as const,
              user: {
                id: mockUserId.toString(),
                email: 'user@example.com',
                name: 'Test User',
                isSuperAdmin: false,
              },
              project: {
                id: mockProjectId.toString(),
                name: 'Test Project',
                effectiveRole: 'editor' as const,
                accessSource: 'direct' as const,
              },
            },
          }
        : {
            authorized: false,
            error: { message: 'Unauthorized', status: 401 },
          }
    );

    if (projectExists) {
      vi.mocked(Project.findById).mockResolvedValue({
        _id: mockProjectId,
        name: 'Test Project',
        organizationId: mockOrgId,
        isFolder: false,
      } as never);
    } else {
      vi.mocked(Project.findById).mockResolvedValue(null);
    }
  };

  const createRequest = (body: Record<string, unknown>) => {
    return new NextRequest(
      `http://localhost/api/projects/${mockProjectId}/test-suites`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  };

  describe('slug generation', () => {
    it('should auto-generate slug from test suite name', async () => {
      setupMocks();

      const request = createRequest({
        name: 'My Test Suite',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(201);
      expect(generateSlug).toHaveBeenCalledWith('My Test Suite');
      expect(ensureUniqueSlug).toHaveBeenCalled();
      expect(mockTestSuiteConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Test Suite',
          slug: 'my-test-suite',
        })
      );
    });

    it('should handle slug uniqueness by calling ensureUniqueSlug', async () => {
      setupMocks();

      // Simulate that the base slug exists, so it gets suffixed
      vi.mocked(ensureUniqueSlug).mockResolvedValue('my-suite-1');

      const request = createRequest({
        name: 'My Suite',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(201);
      expect(mockTestSuiteConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'my-suite-1',
        })
      );
    });

    it('should pass correct uniqueness check function to ensureUniqueSlug', async () => {
      setupMocks();

      let uniquenessCheckFn: ((slug: string) => Promise<boolean>) | null = null;
      vi.mocked(ensureUniqueSlug).mockImplementation(async (slug, checkFn) => {
        uniquenessCheckFn = checkFn;
        return slug;
      });

      vi.mocked(TestSuite.findOne).mockResolvedValue(null);

      const request = createRequest({
        name: 'Test',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(uniquenessCheckFn).not.toBeNull();

      // Test the uniqueness check function
      if (uniquenessCheckFn) {
        await uniquenessCheckFn('test-slug');
        expect(TestSuite.findOne).toHaveBeenCalledWith({
          projectId: mockProjectId.toString(),
          slug: 'test-slug',
        });
      }
    });
  });

  describe('identifier resolution', () => {
    it('should use resolved project ID from auth context', async () => {
      setupMocks();

      const request = createRequest({
        name: 'Test Suite',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      // Pass slug instead of ObjectId
      const response = await POST(request, {
        params: Promise.resolve({ projectId: 'my-project-slug' }),
      });

      expect(response.status).toBe(201);
      // requireProjectPermission is called with the identifier from URL
      expect(requireProjectPermission).toHaveBeenCalledWith(
        'my-project-slug',
        expect.anything(),
        expect.anything()
      );
      // But the test suite is created with the resolved project ID from context
      expect(mockTestSuiteConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId.toString(),
        })
      );
    });
  });

  describe('validation', () => {
    it('should return 401 when not authorized', async () => {
      setupMocks({ authorized: false });

      const request = createRequest({
        name: 'Test Suite',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when project not found', async () => {
      setupMocks({ projectExists: false });

      const request = createRequest({
        name: 'Test Suite',
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 400 when name is missing', async () => {
      setupMocks();

      const request = createRequest({
        targetType: 'prompt',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when targetType is invalid', async () => {
      setupMocks();

      const request = createRequest({
        name: 'Test Suite',
        targetType: 'invalid',
        targetId: mockPromptId.toString(),
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when targetId is missing', async () => {
      setupMocks();

      const request = createRequest({
        name: 'Test Suite',
        targetType: 'prompt',
      });

      const response = await POST(request, {
        params: Promise.resolve({ projectId: mockProjectId.toString() }),
      });

      expect(response.status).toBe(400);
    });
  });
});
