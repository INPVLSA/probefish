import { ProjectExport, TestSuiteOnlyExport, TestSuiteExport, TestRunExport } from "../types";

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format duration in seconds (JUnit standard)
 */
function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(3);
}

/**
 * Generate JUnit XML for a single test suite's latest run
 */
function generateTestSuiteXml(
  suite: TestSuiteExport,
  projectName: string,
  indent: string = ""
): string {
  const latestRun = suite.runHistory?.[0];

  if (!latestRun) {
    // No run history - generate empty suite
    return `${indent}<testsuite name="${escapeXml(suite.name)}" tests="0" failures="0" errors="0" time="0">
${indent}</testsuite>`;
  }

  const tests = latestRun.results.length;
  const failures = latestRun.results.filter(r => !r.validationPassed && !r.error).length;
  const errors = latestRun.results.filter(r => r.error).length;
  const totalTime = latestRun.results.reduce((sum, r) => sum + r.responseTime, 0);

  let xml = `${indent}<testsuite name="${escapeXml(suite.name)}" tests="${tests}" failures="${failures}" errors="${errors}" time="${formatDuration(totalTime)}" timestamp="${latestRun.runAt}">
`;

  // Add properties
  xml += `${indent}  <properties>
${indent}    <property name="project" value="${escapeXml(projectName)}" />
${indent}    <property name="targetType" value="${suite.targetType}" />
${indent}    <property name="avgScore" value="${latestRun.summary.avgScore ?? 'N/A'}" />
${indent}  </properties>
`;

  // Add test cases
  for (const result of latestRun.results) {
    xml += generateTestCaseXml(result, suite.name, indent + "  ");
  }

  xml += `${indent}</testsuite>
`;

  return xml;
}

/**
 * Generate JUnit XML for a single test case result
 */
function generateTestCaseXml(
  result: TestRunExport["results"][0],
  suiteName: string,
  indent: string
): string {
  const className = escapeXml(suiteName.replace(/\s+/g, "_"));
  const testName = escapeXml(result.testCaseName);
  const time = formatDuration(result.responseTime);

  let xml = `${indent}<testcase name="${testName}" classname="${className}" time="${time}">
`;

  if (result.error) {
    // System error
    xml += `${indent}  <error message="${escapeXml(result.error.substring(0, 200))}">
${escapeXml(result.error)}
${indent}  </error>
`;
  } else if (!result.validationPassed) {
    // Test failure
    const failureMessage = result.validationErrors.join("; ") || "Validation failed";
    let details = `Validation Errors:\n${result.validationErrors.map(e => `  - ${e}`).join("\n")}`;

    if (result.judgeScore !== undefined) {
      details += `\n\nJudge Score: ${result.judgeScore}`;
    }
    if (result.judgeReasoning) {
      details += `\nJudge Reasoning: ${result.judgeReasoning}`;
    }

    xml += `${indent}  <failure message="${escapeXml(failureMessage.substring(0, 200))}">
${escapeXml(details)}
${indent}  </failure>
`;
  }

  // Add system-out with the actual output
  if (result.output) {
    xml += `${indent}  <system-out>
${escapeXml(result.output)}
${indent}  </system-out>
`;
  }

  xml += `${indent}</testcase>
`;

  return xml;
}

/**
 * Convert project export to JUnit XML format
 * Following windyroad/JUnit-Schema XSD specification
 */
export function toJUnit(data: ProjectExport | TestSuiteOnlyExport): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;

  if ("project" in data) {
    // Full project export
    const projectExport = data as ProjectExport;
    const projectName = projectExport.project.name;

    // Calculate totals across all suites
    let totalTests = 0;
    let totalFailures = 0;
    let totalErrors = 0;
    let totalTime = 0;

    for (const suite of projectExport.testSuites) {
      const latestRun = suite.runHistory?.[0];
      if (latestRun) {
        totalTests += latestRun.results.length;
        totalFailures += latestRun.results.filter(r => !r.validationPassed && !r.error).length;
        totalErrors += latestRun.results.filter(r => r.error).length;
        totalTime += latestRun.results.reduce((sum, r) => sum + r.responseTime, 0);
      }
    }

    xml += `<testsuites name="${escapeXml(projectName)}" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${formatDuration(totalTime)}">
`;

    for (const suite of projectExport.testSuites) {
      xml += generateTestSuiteXml(suite, projectName, "  ");
    }

    xml += `</testsuites>
`;
  } else {
    // Single test suite export
    const suiteExport = data as TestSuiteOnlyExport;
    const projectName = suiteExport.metadata.projectName;

    xml += `<testsuites name="${escapeXml(suiteExport.testSuite.name)}" tests="0" failures="0" errors="0">
`;
    xml += generateTestSuiteXml(suiteExport.testSuite, projectName, "  ");
    xml += `</testsuites>
`;
  }

  return xml;
}
