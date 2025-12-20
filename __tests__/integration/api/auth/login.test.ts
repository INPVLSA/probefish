import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import { connectTestDB, disconnectTestDB, clearTestDB } from '@/__mocks__/lib/db/mongodb';
import { User } from '@/lib/db/models';

// Integration tests require proper DB mocking setup
// These tests are skipped until connectDB is properly mocked
describe.skip('POST /api/auth/login', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    // Create test user - password will be hashed by model pre-save hook
    await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'Test User',
      settings: { theme: 'system' },
    });
  });

  const createRequest = (body: object) => {
    return new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  describe('successful login', () => {
    it('should login successfully with valid credentials', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Login successful');
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.name).toBe('Test User');
    });

    it('should login with uppercase email (normalized)', async () => {
      const request = createRequest({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.email).toBe('test@example.com');
    });

    it('should return user id in response', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.user.id).toBeDefined();
      expect(typeof data.user.id).toBe('string');
      expect(data.user.id.length).toBeGreaterThan(0);
    });
  });

  describe('failed login - invalid credentials', () => {
    it('should return 401 for invalid email', async () => {
      const request = createRequest({
        email: 'wrong@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should return 401 for invalid password', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });
  });

  describe('validation errors', () => {
    it('should return 400 for invalid email format', async () => {
      const request = createRequest({
        email: 'not-an-email',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 for missing email', async () => {
      const request = createRequest({
        password: 'password123',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const request = createRequest({
        email: 'test@example.com',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const request = createRequest({});

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('super admin flag', () => {
    it('should return isSuperAdmin flag when user is super admin', async () => {
      // Create super admin user
      await User.create({
        email: 'admin@example.com',
        passwordHash: 'admin123',
        name: 'Admin User',
        isSuperAdmin: true,
        settings: { theme: 'system' },
      });

      const request = createRequest({
        email: 'admin@example.com',
        password: 'admin123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.isSuperAdmin).toBe(true);
    });

    it('should return isSuperAdmin as false for regular users', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.user.isSuperAdmin).toBe(false);
    });
  });
});
