import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';
import { connectTestDB, disconnectTestDB, clearTestDB } from '@/__mocks__/lib/db/mongodb';
import { User, Organization } from '@/lib/db/models';

// Integration tests require proper DB mocking setup
// These tests are skipped until connectDB is properly mocked
describe.skip('POST /api/auth/register', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const createRequest = (body: object) => {
    return new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  describe('successful registration', () => {
    it('should register a new user successfully', async () => {
      const request = createRequest({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('Registration successful');
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.name).toBe('New User');
    });

    it('should create a default organization', async () => {
      const request = createRequest({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.organization).toBeDefined();
      expect(data.organization.name).toBe("New User's Workspace");
      expect(data.organization.slug).toBeDefined();
    });

    it('should use custom organization name when provided', async () => {
      const request = createRequest({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        organizationName: 'My Custom Org',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.organization.name).toBe('My Custom Org');
      expect(data.organization.slug).toBe('my-custom-org');
    });

    it('should normalize email to lowercase', async () => {
      const request = createRequest({
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.email).toBe('uppercase@example.com');
    });

    it('should create user in database', async () => {
      const request = createRequest({
        email: 'dbcheck@example.com',
        password: 'password123',
        name: 'DB Check User',
      });

      await POST(request);

      const user = await User.findOne({ email: 'dbcheck@example.com' });
      expect(user).not.toBeNull();
      expect(user?.name).toBe('DB Check User');
    });

    it('should hash the password', async () => {
      const request = createRequest({
        email: 'hashcheck@example.com',
        password: 'password123',
        name: 'Hash Check User',
      });

      await POST(request);

      const user = await User.findOne({ email: 'hashcheck@example.com' });
      expect(user?.passwordHash).not.toBe('password123');
      expect(user?.passwordHash.length).toBeGreaterThan(20); // bcrypt hashes are ~60 chars
    });

    it('should make user owner of the created organization', async () => {
      const request = createRequest({
        email: 'owner@example.com',
        password: 'password123',
        name: 'Owner User',
      });

      const response = await POST(request);
      const data = await response.json();

      const org = await Organization.findById(data.organization.id);
      expect(org?.members[0].role).toBe('owner');
    });
  });

  describe('duplicate email', () => {
    it('should return 409 when email already exists', async () => {
      // Create existing user
      await User.create({
        email: 'existing@example.com',
        passwordHash: 'existingpassword',
        name: 'Existing User',
        settings: { theme: 'system' },
      });

      const request = createRequest({
        email: 'existing@example.com',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    it('should check email case-insensitively', async () => {
      await User.create({
        email: 'existing@example.com',
        passwordHash: 'existingpassword',
        name: 'Existing User',
        settings: { theme: 'system' },
      });

      const request = createRequest({
        email: 'EXISTING@EXAMPLE.COM',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
    });
  });

  describe('validation errors', () => {
    it('should return 400 for invalid email format', async () => {
      const request = createRequest({
        email: 'not-an-email',
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const request = createRequest({
        email: 'user@example.com',
        password: '12345', // Less than 6 characters
        name: 'New User',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 for name too short', async () => {
      const request = createRequest({
        email: 'user@example.com',
        password: 'password123',
        name: 'A', // Less than 2 characters
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing email', async () => {
      const request = createRequest({
        password: 'password123',
        name: 'New User',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const request = createRequest({
        email: 'user@example.com',
        name: 'New User',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing name', async () => {
      const request = createRequest({
        email: 'user@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('organization slug uniqueness', () => {
    it('should create unique slug when organization name conflicts', async () => {
      // Create first user with organization
      const request1 = createRequest({
        email: 'user1@example.com',
        password: 'password123',
        name: 'Test User',
        organizationName: 'My Org',
      });
      const response1 = await POST(request1);
      const data1 = await response1.json();

      // Create second user with same organization name
      const request2 = createRequest({
        email: 'user2@example.com',
        password: 'password123',
        name: 'Test User 2',
        organizationName: 'My Org',
      });
      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(data1.organization.slug).toBe('my-org');
      expect(data2.organization.slug).not.toBe('my-org');
      expect(data2.organization.slug).toMatch(/^my-org-\d+$/);
    });
  });
});
