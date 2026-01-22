import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// Mock dependencies before importing
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/auth/tokenAuth', () => ({
  authenticateToken: vi.fn(),
  hasScope: vi.fn(),
}));

vi.mock('@/lib/db/models/user', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/project', () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/utils/slug', () => ({
  generateSlug: vi.fn((name) => name.toLowerCase().replace(/\s+/g, '-')),
  ensureUniqueSlug: vi.fn(async (slug) => slug),
}));

import { POST } from '@/app/api/projects/route';
import { getSession } from '@/lib/auth/session';
import User from '@/lib/db/models/user';
import Project from '@/lib/db/models/project';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';

describe('Projects API - POST /api/projects', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (overrides: {
    authenticated?: boolean;
    hasOrganization?: boolean;
  } = {}) => {
    const { authenticated = true, hasOrganization = true } = overrides;

    if (authenticated) {
      vi.mocked(getSession).mockResolvedValue({
        userId: mockUserId.toString(),
        email: 'user@example.com',
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: mockUserId,
        email: 'user@example.com',
        name: 'Test User',
        organizationIds: hasOrganization ? [mockOrgId] : [],
      });
    } else {
      vi.mocked(getSession).mockResolvedValue(null);
    }
  };

  const createRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  describe('slug generation', () => {
    it('should auto-generate slug from project name', async () => {
      setupMocks();

      const createdProject = {
        _id: mockProjectId,
        name: 'My Test Project',
        slug: 'my-test-project',
        organizationId: mockOrgId,
        createdBy: mockUserId,
      };

      vi.mocked(Project.create).mockResolvedValue(createdProject as never);

      const request = createRequest({
        name: 'My Test Project',
        description: 'A test project',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(generateSlug).toHaveBeenCalledWith('My Test Project');
      expect(ensureUniqueSlug).toHaveBeenCalled();
      expect(Project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Test Project',
          slug: 'my-test-project',
        })
      );
    });

    it('should handle slug uniqueness by calling ensureUniqueSlug', async () => {
      setupMocks();

      // Simulate that the base slug exists, so it gets suffixed
      vi.mocked(ensureUniqueSlug).mockResolvedValue('my-project-1');

      const createdProject = {
        _id: mockProjectId,
        name: 'My Project',
        slug: 'my-project-1',
        organizationId: mockOrgId,
        createdBy: mockUserId,
      };

      vi.mocked(Project.create).mockResolvedValue(createdProject as never);

      const request = createRequest({
        name: 'My Project',
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(Project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'my-project-1',
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

      vi.mocked(Project.findOne).mockResolvedValue(null);

      const createdProject = {
        _id: mockProjectId,
        name: 'Test',
        slug: 'test',
        organizationId: mockOrgId,
        createdBy: mockUserId,
      };

      vi.mocked(Project.create).mockResolvedValue(createdProject as never);

      const request = createRequest({ name: 'Test' });
      await POST(request);

      expect(uniquenessCheckFn).not.toBeNull();

      // Test the uniqueness check function
      if (uniquenessCheckFn) {
        await uniquenessCheckFn('test-slug');
        expect(Project.findOne).toHaveBeenCalledWith({
          organizationId: mockOrgId,
          slug: 'test-slug',
        });
      }
    });
  });

  describe('validation', () => {
    it('should return 401 when not authenticated', async () => {
      setupMocks({ authenticated: false });

      const request = createRequest({ name: 'Test' });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 404 when user has no organization', async () => {
      setupMocks({ hasOrganization: false });

      const request = createRequest({ name: 'Test' });
      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('should return 400 when name is missing', async () => {
      setupMocks();

      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('name');
    });

    it('should return 400 when name is empty', async () => {
      setupMocks();

      const request = createRequest({ name: '   ' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('project creation', () => {
    it('should create project with all provided fields', async () => {
      setupMocks();

      const createdProject = {
        _id: mockProjectId,
        name: 'Test Project',
        slug: 'test-project',
        description: 'A description',
        organizationId: mockOrgId,
        parentId: null,
        isFolder: false,
        color: '#ff0000',
        icon: 'folder',
        createdBy: mockUserId,
      };

      vi.mocked(Project.create).mockResolvedValue(createdProject as never);

      const request = createRequest({
        name: 'Test Project',
        description: 'A description',
        color: '#ff0000',
        icon: 'folder',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.project.name).toBe('Test Project');
      expect(data.project.slug).toBe('test-project');
      expect(data.project.description).toBe('A description');
      expect(data.project.color).toBe('#ff0000');
      expect(data.project.icon).toBe('folder');
      expect(Project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Project',
          description: 'A description',
          color: '#ff0000',
          icon: 'folder',
          organizationId: mockOrgId,
          createdBy: mockUserId.toString(),
        })
      );
    });

    it('should validate parent folder exists when parentId is provided', async () => {
      setupMocks();

      const parentId = new mongoose.Types.ObjectId();
      vi.mocked(Project.findById).mockResolvedValue({
        _id: parentId,
        organizationId: mockOrgId,
        isFolder: true,
      } as never);

      const createdProject = {
        _id: mockProjectId,
        name: 'Child Project',
        slug: 'child-project',
        parentId,
        organizationId: mockOrgId,
        createdBy: mockUserId,
      };

      vi.mocked(Project.create).mockResolvedValue(createdProject as never);

      const request = createRequest({
        name: 'Child Project',
        parentId: parentId.toString(),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(Project.findById).toHaveBeenCalledWith(parentId.toString());
    });

    it('should return 400 when parent is not a folder', async () => {
      setupMocks();

      const parentId = new mongoose.Types.ObjectId();
      vi.mocked(Project.findById).mockResolvedValue({
        _id: parentId,
        organizationId: mockOrgId,
        isFolder: false, // Not a folder
      } as never);

      const request = createRequest({
        name: 'Child Project',
        parentId: parentId.toString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('folder');
    });
  });
});
