import { Command } from 'commander';
import { startMcpServer } from '../mcp/server.js';
import { info, error } from '../lib/output.js';
import { getToken, getBaseUrl } from '../lib/config.js';

export const mcpCommand = new Command('mcp')
  .description('MCP (Model Context Protocol) server');

mcpCommand
  .command('serve')
  .description('Start MCP server for AI assistant integration')
  .action(async () => {
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

    // Start MCP server (communicates via stdio)
    await startMcpServer();
  });

mcpCommand
  .command('info')
  .description('Show MCP server configuration info')
  .action(() => {
    const token = getToken();
    const baseUrl = getBaseUrl();

    console.log('\nProbefish MCP Server Configuration\n');
    console.log('Add to your Claude Code or MCP client:\n');
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

    console.log('Status:');
    info(`Token: ${token ? 'configured' : 'not set'}`);
    info(`API URL: ${baseUrl ?? 'not set'}`);
    console.log();

    console.log('Available tools:');
    console.log('  - probefish_list_projects     List all projects');
    console.log('  - probefish_list_suites       List test suites in a project');
    console.log('  - probefish_get_suite         Get test suite details');
    console.log('  - probefish_list_test_cases   List test cases');
    console.log('  - probefish_run_suite         Run a test suite');
    console.log('  - probefish_list_runs         List test runs');
    console.log('  - probefish_export            Export test data');
    console.log('  - probefish_add_test_case     Add a test case');
    console.log('  - probefish_update_test_case  Update a test case');
    console.log('  - probefish_delete_test_case  Delete a test case');
    console.log();
  });
