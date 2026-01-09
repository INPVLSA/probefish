import { Command } from 'commander';
import { startMcpServer, startHttpMcpServer } from '../mcp/server.js';
import { info, error } from '../lib/output.js';
import { getToken, getBaseUrl } from '../lib/config.js';

export const mcpCommand = new Command('mcp')
  .description('MCP (Model Context Protocol) server');

mcpCommand
  .command('serve')
  .description('Start MCP server for AI assistant integration')
  .option('--http', 'Run as HTTP server instead of stdio')
  .option('-p, --port <number>', 'HTTP server port (default: 3001)', '3001')
  .option('--no-auth', 'Disable authentication for HTTP mode (not recommended)')
  .action(async (options: { http?: boolean; port?: string; auth?: boolean }) => {
    // Check configuration
    const token = getToken();
    const baseUrl = getBaseUrl();

    if (!token) {
      error('Not authenticated. Run: probefish auth token <token>');
      process.exit(1);
    }

    if (!baseUrl) {
      error('API URL not configured. Run: probefish config set api.baseUrl <url>');
      process.exit(1);
    }

    if (options.http) {
      // HTTP mode
      const port = parseInt(options.port ?? '3001', 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        error('Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }
      const noAuth = options.auth === false;
      await startHttpMcpServer(port, baseUrl, noAuth);
    } else {
      // Stdio mode (default)
      await startMcpServer();
    }
  });

mcpCommand
  .command('info')
  .description('Show MCP server configuration info')
  .action(() => {
    const token = getToken();
    const baseUrl = getBaseUrl();

    console.log('\nProbefish MCP Server Configuration\n');

    console.log('=== Stdio Mode (Claude Desktop, Claude Code) ===\n');
    console.log('Add to your MCP client config:\n');
    console.log('```json');
    console.log(JSON.stringify({
      mcpServers: {
        probefish: {
          command: 'probefish',
          args: ['mcp', 'serve'],
        },
      },
    }, null, 2));
    console.log('```\n');

    console.log('Or with npx (no global install):\n');
    console.log('```json');
    console.log(JSON.stringify({
      mcpServers: {
        probefish: {
          command: 'npx',
          args: ['probefish', 'mcp', 'serve'],
        },
      },
    }, null, 2));
    console.log('```\n');

    console.log('=== HTTP Mode (Remote access, web clients) ===\n');
    console.log('Start server:');
    console.log('  probefish mcp serve --http');
    console.log('  probefish mcp serve --http --port 8080');
    console.log('  probefish mcp serve --http --no-auth  (disable auth, not recommended)\n');
    console.log('Endpoint: http://localhost:3001 (default port)');
    console.log('Auth: Bearer token validated against Probefish API\n');
    console.log('Example request:');
    console.log('```bash');
    console.log('curl -X POST http://localhost:3001 \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer <token>" \\');
    console.log('  -d \'{"jsonrpc":"2.0","method":"tools/list","id":1}\'');
    console.log('```\n');

    console.log('=== Status ===\n');
    info(`Token: ${token ? 'configured' : 'not set'}`);
    info(`API URL: ${baseUrl ?? 'not set'}`);
    console.log();

    console.log('=== Available Tools ===\n');
    console.log('  probefish_list_projects     List all projects');
    console.log('  probefish_list_suites       List test suites in a project');
    console.log('  probefish_get_suite         Get test suite details');
    console.log('  probefish_list_test_cases   List test cases');
    console.log('  probefish_run_suite         Run a test suite');
    console.log('  probefish_list_runs         List test runs');
    console.log('  probefish_get_run           Get test run details');
    console.log('  probefish_export            Export test data');
    console.log('  probefish_add_test_case     Add a test case');
    console.log('  probefish_update_test_case  Update a test case');
    console.log('  probefish_delete_test_case  Delete a test case');
    console.log();
  });
