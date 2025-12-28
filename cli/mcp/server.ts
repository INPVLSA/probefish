import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  listProjects,
  listTestSuites,
  listTestRuns,
  getTestRun,
  getTestSuite,
  runTestSuite,
  exportTestSuite,
  listTestCases,
  addTestCases,
  updateTestCase,
  deleteTestCase,
} from '../lib/api-client.js';
import { getToken, getBaseUrl } from '../lib/config.js';

// Create MCP server
const server = new McpServer({
  name: 'probefish',
  version: '0.9.0',
});

// Helper to check auth
function checkAuth(): void {
  const token = getToken();
  const baseUrl = getBaseUrl();
  if (!token) {
    throw new Error('Not authenticated. Run: probefish auth token <token>');
  }
  if (!baseUrl) {
    throw new Error('API URL not configured. Run: probefish config set api.baseUrl <url>');
  }
}

// Helper to log to stderr (won't interfere with stdio protocol)
function log(message: string): void {
  process.stderr.write(`[probefish-mcp] ${message}\n`);
}

// Tool: List projects
server.registerTool(
  'probefish_list_projects',
  {
    description: 'List all projects accessible with the current token',
  },
  async () => {
    checkAuth();
    const response = await listProjects();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.projects),
        },
      ],
    };
  }
);

// Tool: List test suites
server.registerTool(
  'probefish_list_suites',
  {
    description: 'List test suites in a project (returns summary data, use probefish_get_suite for full details)',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
    },
  },
  async ({ projectId }) => {
    checkAuth();
    const response = await listTestSuites(projectId, { summary: true });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.testSuites),
        },
      ],
    };
  }
);

// Tool: Get test suite details
server.registerTool(
  'probefish_get_suite',
  {
    description: 'Get details of a specific test suite including test cases (lastRun excludes individual results)',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
    },
  },
  async ({ projectId, suiteId }) => {
    checkAuth();
    const response = await getTestSuite(projectId, suiteId, { summary: true });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.testSuite),
        },
      ],
    };
  }
);

// Tool: List test cases
server.registerTool(
  'probefish_list_test_cases',
  {
    description: 'List test cases in a test suite (paginated, default limit 50)',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      limit: z.number().optional().describe('Maximum number of test cases to return (default: 50)'),
      offset: z.number().optional().describe('Number of test cases to skip (default: 0)'),
    },
  },
  async ({ projectId, suiteId, limit, offset }) => {
    checkAuth();
    const response = await listTestCases(projectId, suiteId, {
      limit: limit ?? 50,
      offset: offset ?? 0,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ testCases: response.testCases, pagination: response.pagination }),
        },
      ],
    };
  }
);

// Tool: Run test suite
server.registerTool(
  'probefish_run_suite',
  {
    description: 'Run a test suite and return results',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID to run'),
      iterations: z.number().optional().describe('Number of iterations (default: 1)'),
      model: z.string().optional().describe('Override model in format "provider:model" (e.g., "openai:gpt-4o")'),
    },
  },
  async ({ projectId, suiteId, iterations, model }) => {
    checkAuth();

    let modelOverride: { provider: string; model: string } | undefined;
    if (model) {
      const [provider, modelName] = model.split(':');
      if (provider && modelName) {
        modelOverride = { provider, model: modelName };
      }
    }

    const response = await runTestSuite(projectId, suiteId, {
      iterations,
      modelOverride,
    });

    // Format summary
    const summary = {
      runId: response.run._id,
      status: response.run.status,
      total: response.run.summary.total,
      passed: response.run.summary.passed,
      failed: response.run.summary.failed,
      avgScore: response.run.summary.avgScore,
      avgResponseTime: response.run.summary.avgResponseTime,
      results: response.run.results.map((r) => ({
        testCase: r.testCaseName,
        passed: r.validationPassed,
        score: r.judgeScore,
        responseTime: r.responseTime,
        errors: r.validationErrors,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary),
        },
      ],
    };
  }
);

// Tool: List test runs
server.registerTool(
  'probefish_list_runs',
  {
    description: 'List test runs for a test suite (returns summary data without individual results)',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      limit: z.number().optional().describe('Maximum number of runs to return'),
    },
  },
  async ({ projectId, suiteId, limit }) => {
    checkAuth();
    const response = await listTestRuns(projectId, suiteId, { limit, summary: true });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.runs),
        },
      ],
    };
  }
);

// Tool: Get single test run
server.registerTool(
  'probefish_get_run',
  {
    description: 'Get details of a specific test run including all individual results',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      runId: z.string().describe('The test run ID'),
    },
  },
  async ({ projectId, suiteId, runId }) => {
    checkAuth();
    const response = await getTestRun(projectId, suiteId, runId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.run),
        },
      ],
    };
  }
);

// Tool: Export test suite
server.registerTool(
  'probefish_export',
  {
    description: 'Export test suite data in various formats',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      format: z.enum(['json', 'junit', 'csv']).optional().describe('Export format (default: json)'),
    },
  },
  async ({ projectId, suiteId, format }) => {
    checkAuth();
    const data = await exportTestSuite(projectId, suiteId, format ?? 'json');
    return {
      content: [
        {
          type: 'text',
          text: data,
        },
      ],
    };
  }
);

// Tool: Add test case
server.registerTool(
  'probefish_add_test_case',
  {
    description: 'Add a new test case to a test suite',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      name: z.string().describe('Test case name'),
      inputs: z.record(z.string(), z.string()).optional().describe('Input variables as key-value pairs'),
      expectedOutput: z.string().optional().describe('Expected output for validation'),
      notes: z.string().optional().describe('Notes about the test case'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
    },
  },
  async ({ projectId, suiteId, name, inputs, expectedOutput, notes, tags }) => {
    checkAuth();
    const response = await addTestCases(projectId, suiteId, {
      name,
      inputs,
      expectedOutput,
      notes,
      tags,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.testCases[0]),
        },
      ],
    };
  }
);

// Tool: Update test case
server.registerTool(
  'probefish_update_test_case',
  {
    description: 'Update an existing test case',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      testCaseId: z.string().describe('The test case ID to update'),
      name: z.string().optional().describe('New test case name'),
      inputs: z.record(z.string(), z.string()).optional().describe('New input variables'),
      expectedOutput: z.string().optional().describe('New expected output'),
      notes: z.string().optional().describe('New notes'),
      tags: z.array(z.string()).optional().describe('New tags'),
      enabled: z.boolean().optional().describe('Enable or disable the test case'),
    },
  },
  async ({ projectId, suiteId, testCaseId, ...updates }) => {
    checkAuth();
    const response = await updateTestCase(projectId, suiteId, testCaseId, updates);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.testCase),
        },
      ],
    };
  }
);

// Tool: Delete test case
server.registerTool(
  'probefish_delete_test_case',
  {
    description: 'Delete a test case from a test suite',
    inputSchema: {
      projectId: z.string().describe('The project ID'),
      suiteId: z.string().describe('The test suite ID'),
      testCaseId: z.string().describe('The test case ID to delete'),
    },
  },
  async ({ projectId, suiteId, testCaseId }) => {
    checkAuth();
    const response = await deleteTestCase(projectId, suiteId, testCaseId);
    return {
      content: [
        {
          type: 'text',
          text: `Deleted test case: ${response.deleted.name} (${response.deleted._id})`,
        },
      ],
    };
  }
);

// Start server
export async function startMcpServer(): Promise<void> {
  log('Starting MCP server...');
  const transport = new StdioServerTransport();

  server.server.oninitialized = () => {
    log('MCP server initialized and connected');
  };

  server.server.onerror = (error) => {
    log(`MCP server error: ${error}`);
  };

  try {
    await server.connect(transport);
    log('MCP server connected to transport');
  } catch (error) {
    log(`Failed to connect: ${error}`);
    throw error;
  }
}