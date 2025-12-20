import mongoose from 'mongoose';

export const testUserIds = {
  owner: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId(),
  member: new mongoose.Types.ObjectId(),
  viewer: new mongoose.Types.ObjectId(),
  superAdmin: new mongoose.Types.ObjectId(),
};

export const testUsers = {
  owner: {
    _id: testUserIds.owner,
    email: 'owner@test.com',
    name: 'Test Owner',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X3sG5DvHfz0j0q4Wy', // 'password123'
    isSuperAdmin: false,
    organizationIds: [],
    settings: { theme: 'system' as const },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  admin: {
    _id: testUserIds.admin,
    email: 'admin@test.com',
    name: 'Test Admin',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X3sG5DvHfz0j0q4Wy',
    isSuperAdmin: false,
    organizationIds: [],
    settings: { theme: 'system' as const },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  member: {
    _id: testUserIds.member,
    email: 'member@test.com',
    name: 'Test Member',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X3sG5DvHfz0j0q4Wy',
    isSuperAdmin: false,
    organizationIds: [],
    settings: { theme: 'system' as const },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  viewer: {
    _id: testUserIds.viewer,
    email: 'viewer@test.com',
    name: 'Test Viewer',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X3sG5DvHfz0j0q4Wy',
    isSuperAdmin: false,
    organizationIds: [],
    settings: { theme: 'system' as const },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  superAdmin: {
    _id: testUserIds.superAdmin,
    email: 'superadmin@test.com',
    name: 'Super Admin',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X3sG5DvHfz0j0q4Wy',
    isSuperAdmin: true,
    organizationIds: [],
    settings: { theme: 'system' as const },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const testPassword = 'password123';
