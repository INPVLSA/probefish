import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// Mock the dependencies
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db/models/project', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/user', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/db/models/testSuite', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

import { PATCH } from '@/app/api/projects/[projectId]/test-suites/[suiteId]/route';
import { getSession } from '@/lib/auth/session';
import Project from '@/lib/db/models/project';
import User from '@/lib/db/models/user';
import TestSuite from '@/lib/db/models/testSuite';

describe('Test Suite PATCH API - comparisonModels', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockOrgId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();
  const mockSuiteId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (testSuiteOverrides = {}) => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockMarkModified = vi.fn();

    vi.mocked(getSession).mockResolvedValue({
      userId: mockUserId.toString(),
    });

    vi.mocked(User.findById).mockResolvedValue({
      _id: mockUserId,
      organizationIds: [mockOrgId],
    });

    vi.mocked(Project.findById).mockResolvedValue({
      _id: mockProjectId,
      organizationId: mockOrgId,
    });

    const testSuite = {
      _id: mockSuiteId,
      projectId: mockProjectId,
      name: 'Test Suite',
      comparisonModels: [],
      save: mockSave,
      markModified: mockMarkModified,
      ...testSuiteOverrides,
    };

    vi.mocked(TestSuite.findOne).mockResolvedValue(testSuite);

    return { mockSave, mockMarkModified, testSuite };
  };

  it('should save comparisonModels with isPrimary field', async () => {
    const { mockSave, mockMarkModified, testSuite } = setupMocks();

    const requestBody = {
      comparisonModels: [
        { provider: 'openai', model: 'gpt-4o', isPrimary: true },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', isPrimary: false },
      ],
    };

    const request = new NextRequest('http://localhost/api/projects/test/test-suites/test', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ projectId: mockProjectId.toString(), suiteId: mockSuiteId.toString() }),
    });

    expect(response.status).toBe(200);
    expect(mockMarkModified).toHaveBeenCalledWith('comparisonModels');
    expect(mockSave).toHaveBeenCalled();
    expect(testSuite.comparisonModels).toHaveLength(2);
    expect(testSuite.comparisonModels[0].isPrimary).toBe(true);
    expect(testSuite.comparisonModels[1].isPrimary).toBe(false);
  });

  it('should handle empty comparisonModels array', async () => {
    const { mockSave, mockMarkModified, testSuite } = setupMocks({
      comparisonModels: [
        { provider: 'openai', model: 'gpt-4o', isPrimary: true },
      ],
    });

    const requestBody = {
      comparisonModels: [],
    };

    const request = new NextRequest('http://localhost/api/projects/test/test-suites/test', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ projectId: mockProjectId.toString(), suiteId: mockSuiteId.toString() }),
    });

    expect(response.status).toBe(200);
    expect(testSuite.comparisonModels).toHaveLength(0);
    expect(mockMarkModified).toHaveBeenCalledWith('comparisonModels');
  });

  it('should default isPrimary to false if not provided', async () => {
    const { testSuite } = setupMocks();

    const requestBody = {
      comparisonModels: [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
      ],
    };

    const request = new NextRequest('http://localhost/api/projects/test/test-suites/test', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ projectId: mockProjectId.toString(), suiteId: mockSuiteId.toString() }),
    });

    expect(response.status).toBe(200);
    expect(testSuite.comparisonModels[0].isPrimary).toBe(false);
    expect(testSuite.comparisonModels[1].isPrimary).toBe(false);
  });

  it('should preserve other fields when updating comparisonModels', async () => {
    const { testSuite } = setupMocks({
      name: 'Original Name',
      description: 'Original Description',
    });

    const requestBody = {
      comparisonModels: [
        { provider: 'gemini', model: 'gemini-2.0-flash', isPrimary: true },
      ],
    };

    const request = new NextRequest('http://localhost/api/projects/test/test-suites/test', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });

    await PATCH(request, {
      params: Promise.resolve({ projectId: mockProjectId.toString(), suiteId: mockSuiteId.toString() }),
    });

    expect(testSuite.name).toBe('Original Name');
    expect(testSuite.description).toBe('Original Description');
    expect(testSuite.comparisonModels).toHaveLength(1);
  });

  it('should support all three providers', async () => {
    const { testSuite } = setupMocks();

    const requestBody = {
      comparisonModels: [
        { provider: 'openai', model: 'gpt-4o', isPrimary: true },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        { provider: 'gemini', model: 'gemini-2.0-flash' },
      ],
    };

    const request = new NextRequest('http://localhost/api/projects/test/test-suites/test', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ projectId: mockProjectId.toString(), suiteId: mockSuiteId.toString() }),
    });

    expect(response.status).toBe(200);
    expect(testSuite.comparisonModels).toHaveLength(3);
    expect(testSuite.comparisonModels.map((m: { provider: string }) => m.provider)).toEqual([
      'openai',
      'anthropic',
      'gemini',
    ]);
  });
});
