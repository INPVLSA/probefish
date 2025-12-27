# Testing Architecture

This document describes the testing infrastructure and patterns used in the Probefish project.

## Overview

The project uses **Vitest** as the test runner with **React Testing Library** for component testing. Tests are organized by type (unit, integration, e2e) and follow consistent patterns for mocking and assertions.

## Test Framework Stack

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev/) | Test runner (Jest-compatible, Vite-native) |
| [React Testing Library](https://testing-library.com/react) | Component testing |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | DOM matchers |
| [Playwright](https://playwright.dev/) | End-to-end testing |

## Directory Structure

```
__tests__/
├── unit/                    # Unit tests (isolated, mocked dependencies)
│   ├── api/                 # API route tests
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── test-suites/
│   │   └── user/
│   ├── components/          # React component tests
│   │   └── ui/
│   └── lib/                 # Library/utility tests
│       ├── auth/
│       ├── export/
│       ├── import/
│       ├── llm/
│       ├── testing/
│       ├── utils/
│       └── webhooks/
├── integration/             # Integration tests (real DB, multiple modules)
│   └── api/
│       └── auth/
└── e2e/                     # End-to-end tests (Playwright, excluded from Vitest)

__mocks__/                   # Manual mocks for external modules
__fixtures__/                # Test data fixtures
test-utils/                  # Shared test utilities
```

## Running Tests

```bash
# Run all unit/integration tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with UI
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run e2e tests (Playwright)
npm run test:e2e
npm run test:e2e:ui      # With UI
npm run test:e2e:headed  # In headed browser
```

## Configuration

### vitest.config.ts

Key configuration options:

```typescript
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,              // Use global test/expect/etc.
    environment: 'jsdom',       // DOM environment for components
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['__tests__/e2e/**/*', 'node_modules'],
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    mockReset: true,            // Reset mocks between tests
    restoreMocks: true,         // Restore original implementations
    testTimeout: 10000,
  },
});
```

### vitest.setup.ts

Global setup that runs before all tests:

- Imports `@testing-library/jest-dom` matchers
- Mocks Next.js `cookies()` and `headers()` functions
- Mocks Next.js navigation hooks (`useRouter`, `usePathname`, etc.)
- Sets required environment variables (`JWT_SECRET`, `ENCRYPTION_KEY`, etc.)
- Cleans up DOM after each test

## Writing Tests

### Unit Tests for API Routes

API route tests mock all external dependencies and test the route handler in isolation.

**Pattern:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

// 1. Mock dependencies BEFORE importing the route
vi.mock('@/lib/db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db/models/testSuite', () => ({
  default: { findOne: vi.fn() },
}));

// 2. Import route handler and mocked modules
import { POST } from '@/app/api/projects/[projectId]/test-suites/[suiteId]/run/route';
import { getSession } from '@/lib/auth/session';
import TestSuite from '@/lib/db/models/testSuite';

describe('API Route', () => {
  const mockUserId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 3. Helper to set up common mocks
  const setupMocks = () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: mockUserId.toString(),
    });
    // ... more mock setup
  };

  it('should handle request', async () => {
    setupMocks();

    // 4. Create request
    const request = new NextRequest('http://localhost/api/...', {
      method: 'POST',
      body: JSON.stringify({ /* body */ }),
    });

    // 5. Call route with params
    const response = await POST(request, {
      params: Promise.resolve({ projectId: 'xxx', suiteId: 'yyy' }),
    });

    // 6. Assert response
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### Unit Tests for Libraries

Library tests typically don't require mocking and test pure functions.

```typescript
import { describe, it, expect } from 'vitest';

describe('Utility Function', () => {
  it('should transform input correctly', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Component Tests

Component tests use React Testing Library to render and interact with components.

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## Mocking Patterns

### Mocking Mongoose Models

```typescript
vi.mock('@/lib/db/models/testSuite', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

// In test:
const mockSave = vi.fn();
vi.mocked(TestSuite.findOne).mockResolvedValue({
  _id: new mongoose.Types.ObjectId(),
  name: 'Test',
  save: mockSave,
});
```

### Mocking External Services

```typescript
vi.mock('@/lib/llm/service', () => ({
  callLLM: vi.fn().mockResolvedValue({
    content: 'Mocked response',
    usage: { totalTokens: 100 },
  }),
}));
```

### Mocking Next.js Auth

```typescript
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

// In test:
vi.mocked(getSession).mockResolvedValue({
  userId: 'user-123',
});

// For unauthenticated:
vi.mocked(getSession).mockResolvedValue(null);
```

## Coverage Thresholds

The project enforces minimum coverage thresholds:

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Functions | 80% |
| Branches | 70% |
| Statements | 80% |

CI builds will fail if coverage drops below these thresholds.

## Best Practices

1. **Mock at the boundary**: Mock external dependencies (DB, APIs, etc.), not internal modules
2. **Use `beforeEach` to reset mocks**: Ensures test isolation
3. **Test behavior, not implementation**: Focus on what the code does, not how
4. **Use descriptive test names**: `it('should return 401 when user is not authenticated')`
5. **Group related tests with `describe`**: Organize by feature or scenario
6. **Keep tests focused**: One assertion concept per test (can have multiple `expect` calls)
7. **Use fixtures for complex test data**: Store in `__fixtures__/` directory

## Troubleshooting

### "Cannot find module" errors

Ensure mocks are defined BEFORE importing the module under test:

```typescript
// Wrong - import before mock
import { myFunction } from '@/lib/myModule';
vi.mock('@/lib/dependency');

// Correct - mock before import
vi.mock('@/lib/dependency');
import { myFunction } from '@/lib/myModule';
```

### Tests passing locally but failing in CI

- Check for environment variable differences
- Ensure no tests depend on execution order
- Look for race conditions in async tests

### Mock not being applied

- Verify the mock path matches exactly (case-sensitive)
- Check that `vi.clearAllMocks()` is called in `beforeEach`
- Ensure you're using `vi.mocked()` to access mock functions
