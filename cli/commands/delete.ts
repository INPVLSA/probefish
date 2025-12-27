import { Command } from 'commander';
import ora from 'ora';
import { deleteTestCase } from '../lib/api-client.js';
import { success, warn } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const deleteCommand = new Command('delete')
  .description('Delete resources');

deleteCommand
  .command('test-case <test-case-id>')
  .description('Delete a test case from a test suite')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-s, --suite <id>', 'Test suite ID')
  .option('-y, --yes', 'Skip confirmation')
  .action(
    async (
      testCaseId: string,
      options: {
        project: string;
        suite: string;
        yes?: boolean;
      }
    ) => {
      // Confirmation unless --yes flag
      if (!options.yes) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(`Are you sure you want to delete test case ${testCaseId}? [y/N] `, resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          warn('Cancelled');
          return;
        }
      }

      const spinner = ora('Deleting test case...').start();

      try {
        const response = await deleteTestCase(options.project, options.suite, testCaseId);

        spinner.stop();
        success(`Deleted test case: ${response.deleted.name} (${response.deleted._id})`);
      } catch (err) {
        spinner.stop();
        handleError(err);
      }
    }
  );
