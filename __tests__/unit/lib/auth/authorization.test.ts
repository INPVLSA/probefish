import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Mock dependencies before importing
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth/tokenAuth', () => ({
  authenticateToken: vi.fn(),
}));

vi.mock('@/lib/db/models/user', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/organization', () => ({
  default: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/project', () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/auth/projectPermissions', () => ({
  getProjectAccess: vi.fn(),
  projectRoleHasPermission: vi.fn(),
  PROJECT_PERMISSIONS: {
    VIEW: 'view',
    EDIT: 'edit',
    MANAGE: 'manage',
  },
}));

import { requireProjectPermission, requireAuth } from '@/lib/auth/authorization';
import { getSession, getSessionFromRequest } from '@/lib/auth/session';
import User from '@/lib/db/models/user';
import Organization from '@/lib/db/models/organization';
import Project from '@/lib/db/models/project';
import { getProjectAccess, projectRoleHasPermission } from '@/lib/auth/projectPermissions';

describe('authorization', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return authorized with user context for valid session', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: mockUserId.toString(),
        email: 'user@example.com',
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: mockUserId,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      });

      const result = await requireAuth();

      expect(result.authorized).toBe(true);
      expect(result.context?.user.id).toBe(mockUserId.toString());
      expect(result.context?.user.email).toBe('user@example.com');
    });

    it('should return unauthorized when no session', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const result = await requireAuth();

      expect(result.authorized).toBe(false);
      expect(result.error?.status).toBe(401);
    });
  });

  describe('requireProjectPermission', () => {
    const setupAuthMocks = () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: mockUserId.toString(),
        email: 'user@example.com',
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: mockUserId,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      });
    };

    describe('identifier resolution', () => {
      it('should resolve project by ObjectId', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        vi.mocked(Project.findById).mockResolvedValue(mockProject);
        vi.mocked(Organization.find).mockResolvedValue([]);
        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: true,
          effectiveRole: 'editor',
          source: 'direct',
        });
        vi.mocked(projectRoleHasPermission).mockReturnValue(true);
        vi.mocked(Organization.findById).mockResolvedValue({
          _id: mockOrgId,
          name: 'Test Org',
          members: [],
        });

        const result = await requireProjectPermission(
          mockProjectId.toString(),
          'view' as never
        );

        expect(result.authorized).toBe(true);
        expect(Project.findById).toHaveBeenCalledWith(mockProjectId.toString());
      });

      it('should resolve project by slug when ObjectId lookup fails', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        // ObjectId lookup returns null
        vi.mocked(Project.findById).mockResolvedValue(null);

        // Organization lookup for slug resolution
        vi.mocked(Organization.find).mockResolvedValue([
          { _id: mockOrgId, members: [{ userId: mockUserId }] },
        ]);

        // Slug lookup succeeds
        vi.mocked(Project.findOne).mockResolvedValue(mockProject);

        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: true,
          effectiveRole: 'editor',
          source: 'direct',
        });
        vi.mocked(projectRoleHasPermission).mockReturnValue(true);
        vi.mocked(Organization.findById).mockResolvedValue({
          _id: mockOrgId,
          name: 'Test Org',
          members: [],
        });

        const result = await requireProjectPermission(
          'test-project', // Using slug instead of ObjectId
          'view' as never
        );

        expect(result.authorized).toBe(true);
        expect(Project.findOne).toHaveBeenCalledWith({
          slug: 'test-project',
          organizationId: { $in: [mockOrgId] },
        });
      });

      it('should return 404 when project not found by ObjectId or slug', async () => {
        setupAuthMocks();

        vi.mocked(Project.findById).mockResolvedValue(null);
        vi.mocked(Organization.find).mockResolvedValue([
          { _id: mockOrgId, members: [{ userId: mockUserId }] },
        ]);
        vi.mocked(Project.findOne).mockResolvedValue(null);

        const result = await requireProjectPermission(
          'non-existent-project',
          'view' as never
        );

        expect(result.authorized).toBe(false);
        expect(result.error?.status).toBe(404);
        expect(result.error?.message).toBe('Project not found');
      });

      it('should try slug lookup with lowercase', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        vi.mocked(Project.findById).mockResolvedValue(null);
        vi.mocked(Organization.find).mockResolvedValue([
          { _id: mockOrgId, members: [{ userId: mockUserId }] },
        ]);
        vi.mocked(Project.findOne).mockResolvedValue(mockProject);
        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: true,
          effectiveRole: 'editor',
          source: 'direct',
        });
        vi.mocked(projectRoleHasPermission).mockReturnValue(true);
        vi.mocked(Organization.findById).mockResolvedValue({
          _id: mockOrgId,
          name: 'Test Org',
          members: [],
        });

        const result = await requireProjectPermission(
          'TEST-PROJECT', // Uppercase slug
          'view' as never
        );

        expect(result.authorized).toBe(true);
        expect(Project.findOne).toHaveBeenCalledWith({
          slug: 'test-project', // Should be lowercased
          organizationId: { $in: [mockOrgId] },
        });
      });
    });

    describe('permission checking', () => {
      it('should deny access when user lacks permission', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        vi.mocked(Project.findById).mockResolvedValue(mockProject);
        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: true,
          effectiveRole: 'viewer',
          source: 'direct',
        });
        vi.mocked(projectRoleHasPermission).mockReturnValue(false);

        const result = await requireProjectPermission(
          mockProjectId.toString(),
          'edit' as never
        );

        expect(result.authorized).toBe(false);
        expect(result.error?.status).toBe(403);
      });

      it('should deny access when user has no access to project', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        vi.mocked(Project.findById).mockResolvedValue(mockProject);
        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: false,
          effectiveRole: null,
          source: 'none',
        });

        const result = await requireProjectPermission(
          mockProjectId.toString(),
          'view' as never
        );

        expect(result.authorized).toBe(false);
        expect(result.error?.status).toBe(403);
        expect(result.error?.message).toBe('Access denied to this project');
      });
    });

    describe('context building', () => {
      it('should include resolved project ID in context', async () => {
        setupAuthMocks();

        const mockProject = {
          _id: mockProjectId,
          name: 'Test Project',
          slug: 'test-project',
          organizationId: mockOrgId,
        };

        vi.mocked(Project.findById).mockResolvedValue(null);
        vi.mocked(Organization.find).mockResolvedValue([
          { _id: mockOrgId, members: [{ userId: mockUserId }] },
        ]);
        vi.mocked(Project.findOne).mockResolvedValue(mockProject);
        vi.mocked(getProjectAccess).mockResolvedValue({
          hasAccess: true,
          effectiveRole: 'editor',
          source: 'direct',
        });
        vi.mocked(projectRoleHasPermission).mockReturnValue(true);
        vi.mocked(Organization.findById).mockResolvedValue({
          _id: mockOrgId,
          name: 'Test Org',
          members: [],
        });

        const result = await requireProjectPermission(
          'test-project',
          'view' as never
        );

        expect(result.authorized).toBe(true);
        expect(result.context?.project?.id).toBe(mockProjectId.toString());
        expect(result.context?.project?.name).toBe('Test Project');
      });
    });
  });
});
