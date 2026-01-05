import { Command } from 'commander';
import { writeFileSync } from 'fs';
import ora from 'ora';
import { exportTestSuite } from '../lib/api-client.js';
import { success, error } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const exportCommand = new Command('export')
  .description('Export test suite data')
  .argument('<suite-id>', 'Test suite ID to export')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-f, --format <format>', 'Export format (json, junit, csv)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action(
    async (
      suiteId: string,
      options: {
        project: string;
        format: 'json' | 'junit' | 'csv';
        output?: string;
      }
    ) => {
      const spinner = ora('Exporting test suite...').start();

      try {
        const content = await exportTestSuite(options.project, suiteId, options.format);

        spinner.stop();

        if (options.output) {
          writeFileSync(options.output, content);
          success(`Exported to ${options.output}`);
        } else {
          // Output to stdout
          console.log(content);
        }
      } catch (err) {
        spinner.stop();
        handleError(err);
      }
    }
  );
