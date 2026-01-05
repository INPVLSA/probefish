import { Command } from 'commander';
import { readFileSync } from 'fs';
import ora from 'ora';
import { updateTestCase, type TestCaseInput } from '../lib/api-client.js';
import { success, error, info } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const updateCommand = new Command('update')
  .description('Update resources');

updateCommand
  .command('test-case <test-case-id>')
  .description('Update a test case in a test suite')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-s, --suite <id>', 'Test suite ID')
  .option('-n, --name <name>', 'New test case name')
  .option('-i, --inputs <json>', 'Input variables as JSON')
  .option('-e, --expected <output>', 'Expected output')
  .option('--notes <notes>', 'Notes for the test case')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--enable', 'Enable the test case')
  .option('--disable', 'Disable the test case')
  .option('-f, --file <path>', 'JSON file with updates')
  .option('--stdin', 'Read updates from stdin as JSON')
  .action(
    async (
      testCaseId: string,
      options: {
        project: string;
        suite: string;
        name?: string;
        inputs?: string;
        expected?: string;
        notes?: string;
        tags?: string;
        enable?: boolean;
        disable?: boolean;
        file?: string;
        stdin?: boolean;
      }
    ) => {
      const spinner = ora('Updating test case...').start();

      try {
        let updates: Partial<TestCaseInput>;

        if (options.file) {
          // Read from file
          const content = readFileSync(options.file, 'utf-8');
          updates = JSON.parse(content);
        } else if (options.stdin) {
          // Read from stdin
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          const content = Buffer.concat(chunks).toString('utf-8');
          updates = JSON.parse(content);
        } else {
          // Build updates from options
          updates = {};

          if (options.name) {
            updates.name = options.name;
          }

          if (options.inputs) {
            try {
              updates.inputs = JSON.parse(options.inputs);
            } catch {
              spinner.stop();
              error('Invalid JSON for --inputs');
              process.exit(1);
            }
          }

          if (options.expected !== undefined) {
            updates.expectedOutput = options.expected;
          }

          if (options.notes !== undefined) {
            updates.notes = options.notes;
          }

          if (options.tags) {
            updates.tags = options.tags.split(',').map((t) => t.trim());
          }

          if (options.enable) {
            updates.enabled = true;
          } else if (options.disable) {
            updates.enabled = false;
          }
        }

        // Check if any updates provided
        if (Object.keys(updates).length === 0) {
          spinner.stop();
          error('No updates provided');
          info('Use --name, --inputs, --expected, --notes, --tags, --enable/--disable, --file, or --stdin');
          process.exit(1);
        }

        const response = await updateTestCase(
          options.project,
          options.suite,
          testCaseId,
          updates
        );

        spinner.stop();
        success(`Updated test case: ${response.testCase.name} (${response.testCase._id})`);
      } catch (err) {
        spinner.stop();
        handleError(err);
      }
    }
  );
