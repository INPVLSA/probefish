import { Command } from 'commander';
import { listProjects, listTestSuites, listTestRuns, listTestCases } from '../lib/api-client.js';
import { outputProjects, outputTestSuites, outputTestRuns, outputTestCases } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const listCommand = new Command('list')
  .description('List resources');

listCommand
  .command('projects')
  .description('List all projects')
  .option('-f, --format <format>', 'Output format (table, json)')
  .action(async (options: { format?: 'table' | 'json' }) => {
    try {
      const response = await listProjects();
      outputProjects(response.projects, options.format);
    } catch (err) {
      handleError(err);
    }
  });

listCommand
  .command('suites')
  .description('List test suites in a project')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-f, --format <format>', 'Output format (table, json)')
  .action(async (options: { project: string; format?: 'table' | 'json' }) => {
    try {
      const response = await listTestSuites(options.project);
      outputTestSuites(response.testSuites, options.format);
    } catch (err) {
      handleError(err);
    }
  });

listCommand
  .command('runs')
  .description('List test runs for a suite')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-s, --suite <id>', 'Test suite ID')
  .option('-f, --format <format>', 'Output format (table, json)')
  .option('-l, --limit <n>', 'Limit results', '20')
  .action(
    async (options: {
      project: string;
      suite: string;
      format?: 'table' | 'json';
      limit: string;
    }) => {
      try {
        const response = await listTestRuns(options.project, options.suite, {
          limit: parseInt(options.limit, 10),
        });
        outputTestRuns(response.runs, options.format);
      } catch (err) {
        handleError(err);
      }
    }
  );

listCommand
  .command('test-cases')
  .description('List test cases in a suite')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-s, --suite <id>', 'Test suite ID')
  .option('-f, --format <format>', 'Output format (table, json)')
  .action(
    async (options: {
      project: string;
      suite: string;
      format?: 'table' | 'json';
    }) => {
      try {
        const response = await listTestCases(options.project, options.suite);
        outputTestCases(response.testCases, options.format);
      } catch (err) {
        handleError(err);
      }
    }
  );
