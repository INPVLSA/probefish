import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock the server functions - must be inline in vi.mock for hoisting
vi.mock('@/cli/mcp/server', () => ({
  startMcpServer: vi.fn(),
  startHttpMcpServer: vi.fn(),
}));

// Mock config functions
vi.mock('@/cli/lib/config', () => ({
  getToken: vi.fn(),
  getBaseUrl: vi.fn(),
}));

// Mock output functions
vi.mock('@/cli/lib/output', () => ({
  info: vi.fn(),
  error: vi.fn(),
}));

// Import after mocks
import { mcpCommand } from '@/cli/commands/mcp';
import { startMcpServer, startHttpMcpServer } from '@/cli/mcp/server';
import { getToken, getBaseUrl } from '@/cli/lib/config';

describe('MCP CLI Command', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(startMcpServer).mockResolvedValue(undefined);
    vi.mocked(startHttpMcpServer).mockResolvedValue(undefined);
    // Reset process.exit mock for each test
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('mcp serve', () => {
    const runServeCommand = async (args: string[] = []) => {
      const program = new Command();
      program.addCommand(mcpCommand);
      await program.parseAsync(['node', 'test', 'mcp', 'serve', ...args]);
    };

    describe('authentication checks', () => {
      it('should exit with error if token is not set', async () => {
        vi.mocked(getToken).mockReturnValue(undefined);
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand();

        expect(mockExit).toHaveBeenCalledWith(1);
      });

      it('should exit with error if baseUrl is not set', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue(undefined);

        await runServeCommand();

        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    describe('stdio mode (default)', () => {
      it('should start stdio server when no flags provided', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand();

        expect(startMcpServer).toHaveBeenCalledOnce();
        expect(startHttpMcpServer).not.toHaveBeenCalled();
      });
    });

    describe('HTTP mode', () => {
      it('should start HTTP server when --http flag is provided', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http']);

        expect(startHttpMcpServer).toHaveBeenCalledOnce();
        expect(startHttpMcpServer).toHaveBeenCalledWith(
          3001,
          'https://api.example.com',
          false
        );
        expect(startMcpServer).not.toHaveBeenCalled();
      });

      it('should use default port 3001 when --http is provided without --port', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          3001,
          'https://api.example.com',
          false
        );
      });

      it('should use custom port when --port is provided', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--port', '8080']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          8080,
          'https://api.example.com',
          false
        );
      });

      it('should use custom port with -p shorthand', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '-p', '9000']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          9000,
          'https://api.example.com',
          false
        );
      });

      it('should exit with error for invalid port number', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--port', 'invalid']);

        expect(mockExit).toHaveBeenCalledWith(1);
      });

      it('should exit with error for port number out of range (too high)', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--port', '70000']);

        expect(mockExit).toHaveBeenCalledWith(1);
      });

      it('should exit with error for port number out of range (zero)', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--port', '0']);

        expect(mockExit).toHaveBeenCalledWith(1);
      });

      it('should exit with error for negative port number', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--port', '-1']);

        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    describe('--no-auth flag', () => {
      it('should pass noAuth=true when --no-auth flag is provided', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--no-auth']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          3001,
          'https://api.example.com',
          true
        );
      });

      it('should pass noAuth=false by default (auth enabled)', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          3001,
          'https://api.example.com',
          false
        );
      });

      it('should combine --no-auth with custom port', async () => {
        vi.mocked(getToken).mockReturnValue('test-token');
        vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

        await runServeCommand(['--http', '--no-auth', '--port', '4000']);

        expect(startHttpMcpServer).toHaveBeenCalledWith(
          4000,
          'https://api.example.com',
          true
        );
      });
    });
  });

  describe('mcp info', () => {
    it('should display configuration info including HTTP mode', async () => {
      vi.mocked(getToken).mockReturnValue('test-token');
      vi.mocked(getBaseUrl).mockReturnValue('https://api.example.com');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      program.addCommand(mcpCommand);
      await program.parseAsync(['node', 'test', 'mcp', 'info']);

      // Verify it outputs configuration sections
      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(allOutput).toContain('Stdio Mode');
      expect(allOutput).toContain('HTTP Mode');
      expect(allOutput).toContain('probefish mcp serve --http');
      expect(allOutput).toContain('--no-auth');

      consoleSpy.mockRestore();
    });
  });
});
