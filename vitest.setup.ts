import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock Next.js cookies
vi.mock('next/headers', () => {
  const mockCookies = new Map<string, string>();
  return {
    cookies: vi.fn(() => ({
      get: vi.fn((name: string) => {
        const value = mockCookies.get(name);
        return value ? { name, value } : undefined;
      }),
      set: vi.fn((name: string, value: string) => {
        mockCookies.set(name, value);
      }),
      delete: vi.fn((name: string) => {
        mockCookies.delete(name);
      }),
      getAll: vi.fn(() => Array.from(mockCookies.entries()).map(([name, value]) => ({ name, value }))),
      has: vi.fn((name: string) => mockCookies.has(name)),
    })),
    headers: vi.fn(() => new Headers()),
  };
});

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Set up test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only-32chars!';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.MONGODB_URI = 'mongodb://localhost:27017/probefish-test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
