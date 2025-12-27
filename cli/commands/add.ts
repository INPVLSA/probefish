import { Command } from 'commander';
import { readFileSync } from 'fs';
import ora from 'ora';
import { addTestCases, type TestCaseInput } from '../lib/api-client.js';
import { success, error, info } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const addCommand = new Command('add')
  .description('Add resources');

addCommand
  .command('test-case')
  .description('Add test case(s) to a test suite')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-s, --suite <id>', 'Test suite ID')
  .option('-n, --name <name>', 'Test case name')
  .option('-i, --inputs <json>', 'Input variables as JSON (e.g., \'{"query": "hello"}\')')
  .option('-e, --expected <output>', 'Expected output')
  .option('--notes <notes>', 'Notes for the test case')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-f, --file <path>', 'JSON file with test case(s)')
  .option('--stdin', 'Read test case(s) from stdin as JSON')
  .action(
    async (options: {
      project: string;
      suite: string;
      name?: string;
      inputs?: string;
      expected?: string;
      notes?: string;
      tags?: string;
      file?: string;
      stdin?: boolean;
    }) => {
      const spinner = ora('Adding test case(s)...').start();

      try {
        let testCases: TestCaseInput | TestCaseInput[];

        if (options.file) {
          // Read from file
          const content = readFileSync(options.file, 'utf-8');
          testCases = JSON.parse(content);
        } else if (options.stdin) {
          // Read from stdin
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          const content = Buffer.concat(chunks).toString('utf-8');
          testCases = JSON.parse(content);
        } else if (options.name) {
          // Build single test case from options
          const inputs: Record<string, string> = {};
          if (options.inputs) {
            try {
              Object.assign(inputs, JSON.parse(options.inputs));
            } catch {
              spinner.stop();
              error('Invalid JSON for --inputs');
              process.exit(1);
            }
          }

          testCases = {
            name: options.name,
            inputs,
            expectedOutput: options.expected,
            notes: options.notes,
            tags: options.tags?.split(',').map((t) => t.trim()),
          };
        } else {
          spinner.stop();
          error('Provide test case via --name, --file, or --stdin');
          info('Examples:');
          info('  probefish add test-case -p <project> -s <suite> -n "My test" -i \'{"var": "value"}\'');
          info('  probefish add test-case -p <project> -s <suite> -f test-cases.json');
          info('  echo \'{"name": "Test"}\' | probefish add test-case -p <project> -s <suite> --stdin');
          process.exit(1);
        }

        const response = await addTestCases(options.project, options.suite, testCases);

        spinner.stop();
        success(`Added ${response.added} test case(s)`);

        // Show added test cases
        for (const tc of response.testCases) {
          info(`  - ${tc.name} (${tc._id})`);
        }
      } catch (err) {
        spinner.stop();
        handleError(err);
      }
    }
  );
