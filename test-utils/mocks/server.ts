import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create the mock server with default handlers
export const server = setupServer(...handlers);

// Export helper functions for test setup
export function setupMockServer() {
  return {
    listen: () => server.listen({ onUnhandledRequest: 'warn' }),
    close: () => server.close(),
    reset: () => server.resetHandlers(),
    use: (...customHandlers: Parameters<typeof server.use>) =>
      server.use(...customHandlers),
  };
}
