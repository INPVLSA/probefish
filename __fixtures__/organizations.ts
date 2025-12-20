import mongoose from 'mongoose';
import { testUserIds } from './users';

export const testOrgIds = {
  default: new mongoose.Types.ObjectId(),
  secondary: new mongoose.Types.ObjectId(),
};

export const testOrganizations = {
  default: {
    _id: testOrgIds.default,
    name: 'Test Organization',
    slug: 'test-org',
    ownerId: testUserIds.owner,
    members: [
      { userId: testUserIds.owner, role: 'owner' as const },
      { userId: testUserIds.admin, role: 'admin' as const },
      { userId: testUserIds.member, role: 'member' as const },
      { userId: testUserIds.viewer, role: 'viewer' as const },
    ],
    apiKeys: {
      openai: null,
      anthropic: null,
      gemini: null,
      custom: [],
    },
    settings: {
      defaultJudgeModel: 'gpt-4o-mini',
      maxConcurrentTests: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  secondary: {
    _id: testOrgIds.secondary,
    name: 'Secondary Organization',
    slug: 'secondary-org',
    ownerId: testUserIds.admin,
    members: [
      { userId: testUserIds.admin, role: 'owner' as const },
    ],
    apiKeys: {
      openai: null,
      anthropic: null,
      gemini: null,
      custom: [],
    },
    settings: {
      defaultJudgeModel: 'gpt-4o-mini',
      maxConcurrentTests: 3,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};
