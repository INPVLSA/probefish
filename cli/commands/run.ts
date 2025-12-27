import { Command } from 'commander';
import { writeFileSync } from 'fs';
import ora from 'ora';
import { runTestSuite } from '../lib/api-client.js';
import { outputTestRunResult, outputQuietResult, success, error } from '../lib/output.js';
import { handleError } from '../lib/errors.js';
import type { RunOptions } from '../types.js';

export const runCommand = new Command('run')
  .description('Run a test suite')
  .argument('<suite-id>', 'Test suite ID to run')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-i, --iterations <n>', 'Number of iterations', '1')
  .option('-m, --model <model>', 'Override model (format: provider:model, e.g., openai:gpt-4o)')
  .option('-o, --output <format>', 'Output format (table, json, junit)')
  .option('--output-file <path>', 'Write results to file')
  .option('-q, --quiet', 'Minimal output (just pass/fail)')
  .option('-n, --note <note>', 'Add a note to the test run')
  .action(async (suiteId: string, options: RunOptions & { note?: string }) => {
    const spinner = ora('Running test suite...').start();

    try {
      // Parse model override
      let modelOverride: { provider: string; model: string } | undefined;
      if (options.model) {
        const [provider, model] = options.model.split(':');
        if (!provider || !model) {
          spinner.stop();
          error('Invalid model format. Use: provider:model (e.g., openai:gpt-4o)');
          process.exit(1);
        }
        modelOverride = { provider, model };
      }

      const response = await runTestSuite(options.project, suiteId, {
        iterations: options.iterations ? parseInt(String(options.iterations), 10) : undefined,
        modelOverride,
        note: options.note,
      });

      spinner.stop();

      const { testRun } = response;

      // Determine output format
      const outputFormat = options.output as 'table' | 'json' | 'junit' | undefined;

      // Output to file if specified
      if (options.outputFile) {
        let content: string;
        if (outputFormat === 'junit') {
          content = generateJUnitXML(testRun);
        } else if (outputFormat === 'json') {
          content = JSON.stringify(testRun, null, 2);
        } else {
          content = JSON.stringify(testRun, null, 2);
        }
        writeFileSync(options.outputFile, content);
        success(`Results written to ${options.outputFile}`);
      }

      // Console output
      if (options.quiet) {
        outputQuietResult(testRun);
      } else {
        outputTestRunResult(testRun, outputFormat);
      }

      // Exit with appropriate code
      const exitCode = testRun.summary.failed > 0 ? 1 : 0;
      process.exit(exitCode);
    } catch (err) {
      spinner.stop();
      handleError(err);
    }
  });

function generateJUnitXML(run: {
  summary: { total: number; failed: number; avgResponseTime: number };
  results: Array<{
    testCaseName: string;
    responseTime: number;
    validationPassed: boolean;
    validationErrors: string[];
    error?: string;
  }>;
}): string {
  const failures = run.summary.failed;
  const tests = run.summary.total;
  const time = (run.summary.avgResponseTime * tests) / 1000;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n`;
  xml += `  <testsuite name="Probefish Test Suite" tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n`;

  for (const result of run.results) {
    const testTime = result.responseTime / 1000;
    xml += `    <testcase name="${escapeXML(result.testCaseName)}" time="${testTime.toFixed(3)}"`;

    if (!result.validationPassed) {
      xml += `>\n`;
      const message = result.validationErrors.join('; ') || result.error || 'Test failed';
      xml += `      <failure message="${escapeXML(message)}">${escapeXML(message)}</failure>\n`;
      xml += `    </testcase>\n`;
    } else {
      xml += ` />\n`;
    }
  }

  xml += `  </testsuite>\n`;
  xml += `</testsuites>`;

  return xml;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
