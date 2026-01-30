import chalk from 'chalk';
import { getColorEnabled, getOutputFormat } from './config.js';
import type { Project, TestSuite, TestRun } from '../types.js';

// Check if output is TTY
const isTTY = process.stdout.isTTY ?? false;

function shouldUseColor(): boolean {
  return isTTY && getColorEnabled();
}

function getEffectiveFormat(override?: 'table' | 'json'): 'table' | 'json' {
  if (override) return override;
  // Use JSON for pipes, table for TTY
  if (!isTTY) return 'json';
  return getOutputFormat();
}

// Color helpers
function green(text: string): string {
  return shouldUseColor() ? chalk.green(text) : text;
}

function red(text: string): string {
  return shouldUseColor() ? chalk.red(text) : text;
}

function yellow(text: string): string {
  return shouldUseColor() ? chalk.yellow(text) : text;
}

function cyan(text: string): string {
  return shouldUseColor() ? chalk.cyan(text) : text;
}

function dim(text: string): string {
  return shouldUseColor() ? chalk.dim(text) : text;
}

function bold(text: string): string {
  return shouldUseColor() ? chalk.bold(text) : text;
}

// Table formatting
function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// Output functions
export function outputProjects(projects: Project[], format?: 'table' | 'json'): void {
  const effectiveFormat = getEffectiveFormat(format);

  if (effectiveFormat === 'json') {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (projects.length === 0) {
    console.log(dim('No projects found'));
    return;
  }

  // Table header
  console.log(
    bold(
      `${padRight('ID', 26)} ${padRight('SLUG', 22)} ${padRight('NAME', 25)} ${padRight('VISIBILITY', 12)}`
    )
  );
  console.log(dim('-'.repeat(88)));

  for (const project of projects) {
    const visibility = project.visibility === 'public' ? green('public') : dim('private');
    const slug = project.slug || dim('(none)');
    console.log(
      `${padRight(project._id, 26)} ${padRight(truncate(slug, 20), 22)} ${padRight(truncate(project.name, 23), 25)} ${visibility}`
    );
  }
}

export function outputTestSuites(suites: TestSuite[], format?: 'table' | 'json'): void {
  const effectiveFormat = getEffectiveFormat(format);

  if (effectiveFormat === 'json') {
    console.log(JSON.stringify(suites, null, 2));
    return;
  }

  if (suites.length === 0) {
    console.log(dim('No test suites found'));
    return;
  }

  console.log(
    bold(
      `${padRight('ID', 26)} ${padRight('SLUG', 22)} ${padRight('NAME', 25)} ${padRight('TYPE', 10)} ${padRight('CASES', 6)}`
    )
  );
  console.log(dim('-'.repeat(92)));

  for (const suite of suites) {
    const enabledCases = suite.testCases?.filter((tc) => tc.enabled !== false).length ?? 0;
    const slug = suite.slug || dim('(none)');
    console.log(
      `${padRight(suite._id, 26)} ${padRight(truncate(slug, 20), 22)} ${padRight(truncate(suite.name, 23), 25)} ${padRight(suite.targetType, 10)} ${enabledCases}`
    );
  }
}

export interface TestCaseDisplay {
  _id: string;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  enabled?: boolean;
}

export function outputTestCases(testCases: TestCaseDisplay[], format?: 'table' | 'json'): void {
  const effectiveFormat = getEffectiveFormat(format);

  if (effectiveFormat === 'json') {
    console.log(JSON.stringify(testCases, null, 2));
    return;
  }

  if (testCases.length === 0) {
    console.log(dim('No test cases found'));
    return;
  }

  console.log(
    bold(
      `${padRight('ID', 26)} ${padRight('NAME', 35)} ${padRight('INPUTS', 20)} ${padRight('ENABLED', 8)}`
    )
  );
  console.log(dim('-'.repeat(92)));

  for (const tc of testCases) {
    const inputKeys = Object.keys(tc.inputs).join(', ');
    const enabled = tc.enabled !== false ? green('yes') : dim('no');
    console.log(
      `${padRight(tc._id, 26)} ${padRight(truncate(tc.name, 33), 35)} ${padRight(truncate(inputKeys, 18), 20)} ${enabled}`
    );
  }
}

export function outputTestRuns(runs: TestRun[], format?: 'table' | 'json'): void {
  const effectiveFormat = getEffectiveFormat(format);

  if (effectiveFormat === 'json') {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  if (runs.length === 0) {
    console.log(dim('No test runs found'));
    return;
  }

  console.log(
    bold(
      `${padRight('ID', 26)} ${padRight('DATE', 20)} ${padRight('STATUS', 12)} ${padRight('PASSED', 8)} ${padRight('FAILED', 8)}`
    )
  );
  console.log(dim('-'.repeat(80)));

  for (const run of runs) {
    const date = new Date(run.runAt).toLocaleString();
    const statusColor =
      run.status === 'completed'
        ? run.summary.failed === 0
          ? green
          : yellow
        : run.status === 'failed'
          ? red
          : cyan;
    const status = statusColor(run.status);

    console.log(
      `${padRight(run._id, 26)} ${padRight(date, 20)} ${padRight(status, 12)} ${green(String(run.summary.passed).padStart(6))} ${red(String(run.summary.failed).padStart(6))}`
    );
  }
}

export function outputTestRunResult(run: TestRun, format?: 'table' | 'json' | 'junit'): void {
  const effectiveFormat = format ?? getEffectiveFormat();

  if (effectiveFormat === 'json') {
    console.log(JSON.stringify(run, null, 2));
    return;
  }

  if (effectiveFormat === 'junit') {
    // JUnit XML output
    console.log(generateJUnitXML(run));
    return;
  }

  // Table format - summary first
  console.log();
  console.log(bold('Test Run Summary'));
  console.log(dim('-'.repeat(50)));
  console.log(`Status:        ${run.status === 'completed' ? green('completed') : red(run.status)}`);
  console.log(`Total:         ${run.summary.total}`);
  console.log(`Passed:        ${green(String(run.summary.passed))}`);
  console.log(`Failed:        ${red(String(run.summary.failed))}`);
  if (run.summary.avgScore !== undefined) {
    console.log(`Avg Score:     ${run.summary.avgScore.toFixed(1)}`);
  }
  console.log(`Avg Response:  ${run.summary.avgResponseTime.toFixed(0)}ms`);
  console.log();

  // Individual results
  console.log(bold('Test Results'));
  console.log(dim('-'.repeat(80)));

  for (const result of run.results) {
    const status = result.validationPassed ? green('PASS') : red('FAIL');
    const score = result.judgeScore !== undefined ? `${result.judgeScore.toFixed(1)}` : '-';
    const conversationIndicator = result.isConversation ? cyan(`[${result.totalTurns} turns] `) : '';

    console.log(`${status} ${conversationIndicator}${truncate(result.testCaseName, result.isConversation ? 30 : 40).padEnd(result.isConversation ? 32 : 42)} Score: ${score.padStart(5)} Time: ${String(result.responseTime).padStart(5)}ms`);

    // Show conversation turn details for failed conversation tests
    if (result.isConversation && result.turnResults && !result.validationPassed) {
      for (const turn of result.turnResults) {
        if (turn.role === 'user' && (turn.error || (turn.validationErrors && turn.validationErrors.length > 0))) {
          const turnStatus = turn.validationPassed === false ? red('FAIL') : dim('----');
          console.log(`     ${dim(`Turn ${turn.turnIndex + 1}:`)} ${turnStatus} ${dim(`(${turn.responseTime}ms)`)}`);
          if (turn.validationErrors) {
            for (const error of turn.validationErrors) {
              console.log(`       ${red('>')} ${error}`);
            }
          }
          if (turn.error) {
            console.log(`       ${red('>')} ${turn.error}`);
          }
        }
      }
    }

    if (!result.validationPassed && result.validationErrors.length > 0) {
      for (const error of result.validationErrors) {
        console.log(`     ${red('>')} ${error}`);
      }
    }

    if (result.error) {
      console.log(`     ${red('>')} ${result.error}`);
    }
  }
}

export function outputQuietResult(run: TestRun): void {
  const passed = run.summary.failed === 0;
  if (passed) {
    console.log(green(`PASS - ${run.summary.passed}/${run.summary.total} tests passed`));
  } else {
    console.log(red(`FAIL - ${run.summary.passed}/${run.summary.total} tests passed`));
  }
}

function generateJUnitXML(run: TestRun): string {
  const failures = run.summary.failed;
  const tests = run.summary.total;
  const time = (run.summary.avgResponseTime * tests) / 1000;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n`;
  xml += `  <testsuite name="Probefish Test Suite" tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n`;

  for (const result of run.results) {
    const testTime = result.responseTime / 1000;
    const testName = result.isConversation
      ? `${result.testCaseName} (${result.totalTurns} turns)`
      : result.testCaseName;

    xml += `    <testcase name="${escapeXML(testName)}" time="${testTime.toFixed(3)}"`;

    if (!result.validationPassed) {
      xml += `>\n`;

      // Build detailed failure message for conversation tests
      let message = '';
      if (result.isConversation && result.turnResults) {
        const failedTurns = result.turnResults.filter(
          (t) => t.role === 'user' && (t.error || (t.validationErrors && t.validationErrors.length > 0))
        );
        if (failedTurns.length > 0) {
          message = failedTurns
            .map((t) => `Turn ${t.turnIndex + 1}: ${t.validationErrors?.join('; ') || t.error || 'Failed'}`)
            .join('\n');
        }
      }
      if (!message) {
        message = result.validationErrors.join('; ') || result.error || 'Test failed';
      }

      xml += `      <failure message="${escapeXML(message.split('\n')[0])}">${escapeXML(message)}</failure>\n`;
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

export function success(message: string): void {
  console.log(green(`✓ ${message}`));
}

export function info(message: string): void {
  console.log(cyan(`ℹ ${message}`));
}

export function warn(message: string): void {
  console.log(yellow(`⚠ ${message}`));
}

export function error(message: string): void {
  console.log(red(`✗ ${message}`));
}
