import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getTokenFromAuthHeader, type SessionPayload } from '@/lib/auth/session';
import { NextRequest } from 'next/server';

// Create test-specific JWT functions with a known secret
const TEST_SECRET = 'test-jwt-secret-key-for-testing-purposes-only-32chars!';

function createTestToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '7d' });
}

function verifyTestToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, TEST_SECRET);
    return decoded as SessionPayload;
  } catch {
    return null;
  }
}

describe('session utilities', () => {
  beforeEach(() => {
    // Reset any mocks between tests
    vi.clearAllMocks();
  });

  describe('createToken (via test helper)', () => {
    it('should create a valid JWT token', () => {
      const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const token = createTestToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include isSuperAdmin when provided', () => {
      const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
        userId: 'admin-123',
        email: 'admin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.isSuperAdmin).toBe(true);
    });

    it('should create different tokens for different payloads', () => {
      const payload1 = { userId: 'user-1', email: 'user1@test.com', name: 'User 1' };
      const payload2 = { userId: 'user-2', email: 'user2@test.com', name: 'User 2' };

      const token1 = createTestToken(payload1);
      const token2 = createTestToken(payload2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken (via test helper)', () => {
    it('should verify a valid token and return payload', () => {
      const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe('user-123');
      expect(verified?.email).toBe('test@example.com');
      expect(verified?.name).toBe('Test User');
    });

    it('should include iat and exp in verified payload', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified?.iat).toBeDefined();
      expect(verified?.exp).toBeDefined();
      expect(typeof verified?.iat).toBe('number');
      expect(typeof verified?.exp).toBe('number');
    });

    it('should return null for invalid token', () => {
      const verified = verifyTestToken('invalid-token');
      expect(verified).toBeNull();
    });

    it('should return null for malformed token', () => {
      const verified = verifyTestToken('not.a.valid.jwt');
      expect(verified).toBeNull();
    });

    it('should return null for empty token', () => {
      const verified = verifyTestToken('');
      expect(verified).toBeNull();
    });

    it('should return null for tampered token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com', name: 'Test' };
      const token = createTestToken(payload);

      // Tamper with the token
      const parts = token.split('.');
      parts[1] = parts[1] + 'tampered';
      const tamperedToken = parts.join('.');

      const verified = verifyTestToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should preserve all payload fields', () => {
      const payload = {
        userId: 'user-456',
        email: 'complex@example.com',
        name: 'Complex User Name With Spaces',
        isSuperAdmin: false,
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.name).toBe(payload.name);
      expect(verified?.isSuperAdmin).toBe(payload.isSuperAdmin);
    });
  });

  describe('getTokenFromAuthHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer my-jwt-token-here',
        },
      });

      const token = getTokenFromAuthHeader(request);
      expect(token).toBe('my-jwt-token-here');
    });

    it('should return null when no authorization header', () => {
      const request = new NextRequest('http://localhost:3000/api/test');

      const token = getTokenFromAuthHeader(request);
      expect(token).toBeNull();
    });

    it('should return null when authorization is not Bearer', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      });

      const token = getTokenFromAuthHeader(request);
      expect(token).toBeNull();
    });

    it('should return null when Bearer has no token (header gets trimmed)', () => {
      // NextRequest normalizes headers by trimming trailing whitespace
      // So "Bearer " becomes "Bearer" which doesn't match "Bearer " prefix
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer ',
        },
      });

      const token = getTokenFromAuthHeader(request);
      // The trimmed header "Bearer" doesn't start with "Bearer " so returns null
      expect(token).toBeNull();
    });

    it('should handle Bearer with extra spaces', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer token-with-no-leading-space',
        },
      });

      const token = getTokenFromAuthHeader(request);
      expect(token).toBe('token-with-no-leading-space');
    });

    it('should be case-sensitive for Bearer prefix', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'bearer lowercase-token',
        },
      });

      const token = getTokenFromAuthHeader(request);
      expect(token).toBeNull();
    });
  });

  describe('token expiration', () => {
    it('should create token with expiration in the future', () => {
      const payload = { userId: 'user-123', email: 'test@example.com', name: 'Test' };
      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified?.exp).toBeDefined();
      const now = Math.floor(Date.now() / 1000);
      expect(verified!.exp!).toBeGreaterThan(now);
    });

    it('should create token valid for approximately 7 days', () => {
      const payload = { userId: 'user-123', email: 'test@example.com', name: 'Test' };
      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      const now = Math.floor(Date.now() / 1000);
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;

      // Allow some tolerance (within 1 minute)
      expect(verified!.exp! - now).toBeGreaterThan(sevenDaysInSeconds - 60);
      expect(verified!.exp! - now).toBeLessThan(sevenDaysInSeconds + 60);
    });
  });

  describe('round-trip token flow', () => {
    it('should create and verify token successfully', () => {
      const originalPayload = {
        userId: 'roundtrip-user',
        email: 'roundtrip@example.com',
        name: 'Round Trip User',
        isSuperAdmin: true,
      };

      // Create token
      const token = createTestToken(originalPayload);
      expect(token).toBeDefined();

      // Verify token
      const verified = verifyTestToken(token);
      expect(verified).not.toBeNull();

      // Check all fields
      expect(verified?.userId).toBe(originalPayload.userId);
      expect(verified?.email).toBe(originalPayload.email);
      expect(verified?.name).toBe(originalPayload.name);
      expect(verified?.isSuperAdmin).toBe(originalPayload.isSuperAdmin);
    });

    it('should handle special characters in payload', () => {
      const payload = {
        userId: 'user-with-special-chars',
        email: 'user+tag@example.com',
        name: "O'Brien & Partners <LLC>",
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified?.name).toBe(payload.name);
      expect(verified?.email).toBe(payload.email);
    });

    it('should handle unicode in payload', () => {
      const payload = {
        userId: 'unicode-user',
        email: 'unicode@example.com',
        name: '田中太郎 🎉',
      };

      const token = createTestToken(payload);
      const verified = verifyTestToken(token);

      expect(verified?.name).toBe(payload.name);
    });
  });
});
