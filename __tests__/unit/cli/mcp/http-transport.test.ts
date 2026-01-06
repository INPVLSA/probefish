import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Create stable mock functions for transport
const mockHandleRequest = vi.fn();
const mockClose = vi.fn();

// Mock transport
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: class MockTransport {
    handleRequest = mockHandleRequest;
    close = mockClose;
    constructor() {
      mockHandleRequest.mockImplementation(
        async (
          _req: IncomingMessage,
          res: ServerResponse,
          _body?: unknown
        ) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', result: {}, id: 1 }));
        }
      );
      mockClose.mockResolvedValue(undefined);
    }
  },
}));

// Mock API client for token validation - use inline function for hoisting
vi.mock('@/cli/lib/api-client', () => ({
  validateBearerToken: vi.fn(),
}));

import { createHttpMcpServer, HttpServerContext } from '@/cli/mcp/http-transport';
import { validateBearerToken } from '@/cli/lib/api-client';

describe('HTTP MCP Transport', () => {
  let serverContext: HttpServerContext | null = null;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: token validation succeeds
    vi.mocked(validateBearerToken).mockResolvedValue(true);
  });

  afterEach(async () => {
    if (serverContext) {
      await serverContext.close();
      serverContext = null;
    }
  });

  const startServer = async (options: { noAuth?: boolean } = {}): Promise<string> => {
    serverContext = createHttpMcpServer({
      port: 0,
      baseUrl: 'https://api.probefish.com',
      noAuth: options.noAuth,
    });
    return new Promise((resolve) => {
      serverContext!.server.listen(0, () => {
        const addr = serverContext!.server.address() as AddressInfo;
        baseUrl = `http://localhost:${addr.port}`;
        resolve(baseUrl);
      });
    });
  };

  describe('createHttpMcpServer', () => {
    it('should create server and transport', () => {
      const context = createHttpMcpServer({
        port: 3001,
        baseUrl: 'https://api.probefish.com',
      });
      expect(context.server).toBeDefined();
      expect(context.transport).toBeDefined();
      expect(context.close).toBeDefined();
    });

    it('should return a close function that closes both transport and server', async () => {
      serverContext = createHttpMcpServer({
        port: 0,
        baseUrl: 'https://api.probefish.com',
      });

      await new Promise<void>((resolve) => {
        serverContext!.server.listen(0, () => resolve());
      });

      await serverContext.close();
      expect(mockClose).toHaveBeenCalled();
      serverContext = null;
    });
  });

  describe('CORS handling', () => {
    it('should respond to OPTIONS with CORS headers', async () => {
      const url = await startServer();

      const response = await fetch(url, { method: 'OPTIONS' });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET, POST, DELETE, OPTIONS'
      );
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'Content-Type, Authorization, Mcp-Session-Id'
      );
    });
  });

  describe('Authentication (default mode)', () => {
    it('should reject requests without Authorization header', async () => {
      const url = await startServer();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing Bearer token');
    });

    it('should reject requests with invalid token', async () => {
      vi.mocked(validateBearerToken).mockResolvedValue(false);
      const url = await startServer();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Invalid token');
      expect(vi.mocked(validateBearerToken)).toHaveBeenCalledWith(
        'invalid-token',
        'https://api.probefish.com'
      );
    });

    it('should reject non-Bearer auth schemes', async () => {
      const url = await startServer();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic dXNlcjpwYXNz',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing Bearer token');
    });

    it('should accept requests with valid token and delegate to transport', async () => {
      vi.mocked(validateBearerToken).mockResolvedValue(true);
      const url = await startServer();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      expect(response.status).toBe(200);
      expect(mockHandleRequest).toHaveBeenCalled();
      expect(vi.mocked(validateBearerToken)).toHaveBeenCalledWith(
        'valid-token',
        'https://api.probefish.com'
      );
    });

    it('should cache valid tokens', async () => {
      vi.mocked(validateBearerToken).mockResolvedValue(true);
      const url = await startServer();

      // First request validates token
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cached-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      // Second request with same token should use cache
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cached-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 2 }),
      });

      // Token should only be validated once due to caching
      expect(vi.mocked(validateBearerToken)).toHaveBeenCalledTimes(1);
    });
  });

  describe('No-auth mode (--no-auth)', () => {
    it('should skip authentication when noAuth is true', async () => {
      const url = await startServer({ noAuth: true });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
      });

      expect(response.status).toBe(200);
      expect(mockHandleRequest).toHaveBeenCalled();
      expect(vi.mocked(validateBearerToken)).not.toHaveBeenCalled();
    });

    it('should not require Authorization header when noAuth is true', async () => {
      const url = await startServer({ noAuth: true });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Request body parsing', () => {
    it('should reject invalid JSON body', async () => {
      vi.mocked(validateBearerToken).mockResolvedValue(true);
      const url = await startServer();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: 'not valid json{',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid JSON body');
    });

    it('should pass parsed body to transport for valid JSON', async () => {
      vi.mocked(validateBearerToken).mockResolvedValue(true);
      const url = await startServer();
      const requestBody = { jsonrpc: '2.0', method: 'tools/list', id: 1 };

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(requestBody),
      });

      expect(mockHandleRequest).toHaveBeenCalled();
      const lastCall = mockHandleRequest.mock.calls[mockHandleRequest.mock.calls.length - 1];
      expect(lastCall[2]).toEqual(requestBody);
    });
  });
});
