import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';

// Mock the HTTP transport module
const mockHttpServer = {
  listen: vi.fn((port: number, callback: () => void) => {
    callback();
    return mockHttpServer;
  }),
  close: vi.fn((callback: () => void) => callback()),
};

const mockTransport = {
  handleRequest: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/cli/mcp/http-transport', () => ({
  createHttpMcpServer: vi.fn(() => ({
    server: mockHttpServer,
    transport: mockTransport,
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the SDK transports
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class MockMcpServer {
      server = {
        oninitialized: null as (() => void) | null,
        onerror: null as ((error: Error) => void) | null,
      };
      connect = vi.fn().mockResolvedValue(undefined);
      registerTool = vi.fn();
    },
  };
});

// Mock config
vi.mock('@/cli/lib/config', () => ({
  getToken: vi.fn().mockReturnValue('test-token'),
  getBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
}));

// Mock API client
vi.mock('@/cli/lib/api-client', () => ({
  listProjects: vi.fn(),
  listTestSuites: vi.fn(),
  listTestRuns: vi.fn(),
  getTestRun: vi.fn(),
  getTestSuite: vi.fn(),
  runTestSuite: vi.fn(),
  exportTestSuite: vi.fn(),
  listTestCases: vi.fn(),
  addTestCases: vi.fn(),
  updateTestCase: vi.fn(),
  deleteTestCase: vi.fn(),
}));

// Import after mocks
import { startHttpMcpServer, startMcpServer, server } from '@/cli/mcp/server';
import { createHttpMcpServer } from '@/cli/mcp/http-transport';

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('server instance', () => {
    it('should export the MCP server instance', () => {
      expect(server).toBeDefined();
    });
  });

  describe('startMcpServer (stdio mode)', () => {
    it('should create stdio transport and connect', async () => {
      await startMcpServer();

      expect(server.connect).toHaveBeenCalledOnce();
    });
  });

  describe('startHttpMcpServer', () => {
    let originalStderr: typeof process.stderr.write;
    let originalOn: typeof process.on;

    beforeEach(() => {
      // Suppress stderr logging
      originalStderr = process.stderr.write;
      process.stderr.write = vi.fn() as typeof process.stderr.write;

      // Mock process.on to capture signal handlers
      originalOn = process.on;
      process.on = vi.fn() as typeof process.on;
    });

    afterEach(() => {
      process.stderr.write = originalStderr;
      process.on = originalOn;
    });

    it('should create HTTP server with correct port and baseUrl', async () => {
      await startHttpMcpServer(3001, 'https://api.example.com');

      expect(createHttpMcpServer).toHaveBeenCalledWith({
        port: 3001,
        baseUrl: 'https://api.example.com',
        noAuth: undefined,
      });
    });

    it('should connect the MCP server to the HTTP transport', async () => {
      await startHttpMcpServer(3001, 'https://api.example.com');

      expect(server.connect).toHaveBeenCalled();
    });

    it('should start listening on the specified port', async () => {
      await startHttpMcpServer(8080, 'https://api.example.com');

      expect(mockHttpServer.listen).toHaveBeenCalled();
      const listenCall = mockHttpServer.listen.mock.calls[0];
      expect(listenCall[0]).toBe(8080);
    });

    it('should register SIGINT handler for graceful shutdown', async () => {
      await startHttpMcpServer(3001, 'https://api.example.com');

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register SIGTERM handler for graceful shutdown', async () => {
      await startHttpMcpServer(3001, 'https://api.example.com');

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should use different ports when called with different values', async () => {
      vi.mocked(createHttpMcpServer).mockClear();

      await startHttpMcpServer(4000, 'https://api.probefish.com');

      expect(createHttpMcpServer).toHaveBeenCalledWith({
        port: 4000,
        baseUrl: 'https://api.probefish.com',
        noAuth: undefined,
      });
    });

    it('should pass noAuth option when provided', async () => {
      vi.mocked(createHttpMcpServer).mockClear();

      await startHttpMcpServer(3001, 'https://api.example.com', true);

      expect(createHttpMcpServer).toHaveBeenCalledWith({
        port: 3001,
        baseUrl: 'https://api.example.com',
        noAuth: true,
      });
    });
  });
});
