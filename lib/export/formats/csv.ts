import archiver from "archiver";
import { Writable } from "stream";
import { ProjectExport, TestSuiteOnlyExport, TestSuiteExport } from "../types";

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV row from values
 */
function csvRow(values: unknown[]): string {
  return values.map(escapeCSV).join(",") + "\n";
}

/**
 * Generate prompts CSV
 */
function generatePromptsCSV(data: ProjectExport): string {
  let csv = csvRow([
    "export_id",
    "name",
    "description",
    "current_version",
    "version_count",
    "tags",
    "latest_content",
    "latest_system_prompt",
    "provider",
    "model",
    "temperature",
    "max_tokens",
  ]);

  for (const prompt of data.prompts) {
    const latestVersion = prompt.versions.find(
      (v) => v.version === prompt.currentVersion
    );
    csv += csvRow([
      prompt._exportId,
      prompt.name,
      prompt.description || "",
      prompt.currentVersion,
      prompt.versions.length,
      prompt.tags.join("; "),
      latestVersion?.content || "",
      latestVersion?.systemPrompt || "",
      latestVersion?.modelConfig.provider || "",
      latestVersion?.modelConfig.model || "",
      latestVersion?.modelConfig.temperature ?? "",
      latestVersion?.modelConfig.maxTokens ?? "",
    ]);
  }

  return csv;
}

/**
 * Generate endpoints CSV
 */
function generateEndpointsCSV(data: ProjectExport): string {
  let csv = csvRow([
    "export_id",
    "name",
    "description",
    "method",
    "url",
    "content_type",
    "auth_type",
    "variables",
    "response_path",
  ]);

  for (const endpoint of data.endpoints) {
    csv += csvRow([
      endpoint._exportId,
      endpoint.name,
      endpoint.description || "",
      endpoint.config.method,
      endpoint.config.url,
      endpoint.config.contentType || "",
      endpoint.config.auth?.type || "none",
      endpoint.variables.join("; "),
      endpoint.config.responseContentPath || "",
    ]);
  }

  return csv;
}

/**
 * Generate test cases CSV
 */
function generateTestCasesCSV(
  suites: TestSuiteExport[],
  includeExportIds: boolean = true
): string {
  let csv = csvRow([
    "suite_name",
    "suite_export_id",
    "test_case_name",
    "inputs",
    "expected_output",
    "notes",
  ]);

  for (const suite of suites) {
    for (const testCase of suite.testCases) {
      csv += csvRow([
        suite.name,
        includeExportIds ? suite._exportId : "",
        testCase.name,
        JSON.stringify(testCase.inputs),
        testCase.expectedOutput || "",
        testCase.notes || "",
      ]);
    }
  }

  return csv;
}

/**
 * Generate test results CSV
 */
function generateTestResultsCSV(suites: TestSuiteExport[]): string {
  let csv = csvRow([
    "suite_name",
    "run_at",
    "test_case_name",
    "inputs",
    "output",
    "validation_passed",
    "validation_errors",
    "judge_score",
    "judge_reasoning",
    "response_time_ms",
    "error",
  ]);

  for (const suite of suites) {
    for (const run of suite.runHistory || []) {
      for (const result of run.results) {
        csv += csvRow([
          suite.name,
          run.runAt,
          result.testCaseName,
          JSON.stringify(result.inputs),
          result.output,
          result.validationPassed,
          result.validationErrors.join("; "),
          result.judgeScore ?? "",
          result.judgeReasoning || "",
          result.responseTime,
          result.error || "",
        ]);
      }
    }
  }

  return csv;
}

/**
 * Generate summary CSV
 */
function generateSummaryCSV(data: ProjectExport | TestSuiteOnlyExport): string {
  let csv = csvRow([
    "suite_name",
    "run_at",
    "status",
    "total",
    "passed",
    "failed",
    "avg_score",
    "avg_response_time_ms",
  ]);

  const suites =
    "project" in data ? data.testSuites : [data.testSuite];

  for (const suite of suites) {
    for (const run of suite.runHistory || []) {
      csv += csvRow([
        suite.name,
        run.runAt,
        run.status,
        run.summary.total,
        run.summary.passed,
        run.summary.failed,
        run.summary.avgScore ?? "",
        run.summary.avgResponseTime,
      ]);
    }
  }

  return csv;
}

/**
 * Generate webhooks CSV
 */
function generateWebhooksCSV(data: ProjectExport): string {
  let csv = csvRow([
    "name",
    "url",
    "events",
    "status",
    "only_on_failure",
    "only_on_regression",
    "retry_count",
    "retry_delay_ms",
    "suite_refs",
  ]);

  for (const webhook of data.webhooks) {
    csv += csvRow([
      webhook.name,
      webhook.url,
      webhook.events.join("; "),
      webhook.status,
      webhook.onlyOnFailure ?? false,
      webhook.onlyOnRegression ?? false,
      webhook.retryCount,
      webhook.retryDelayMs,
      webhook.suiteRefs?.join("; ") || "",
    ]);
  }

  return csv;
}

/**
 * Convert export data to CSV format (ZIP archive with multiple files)
 */
export async function toCSV(
  data: ProjectExport | TestSuiteOnlyExport
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writableStream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", reject);
    writableStream.on("finish", () => resolve(Buffer.concat(chunks)));

    archive.pipe(writableStream);

    if ("project" in data) {
      // Full project export
      const projectExport = data as ProjectExport;

      // Add metadata
      archive.append(
        JSON.stringify(projectExport.metadata, null, 2),
        { name: "metadata.json" }
      );

      // Add project info
      archive.append(
        JSON.stringify(projectExport.project, null, 2),
        { name: "project.json" }
      );

      // Add CSVs
      archive.append(generatePromptsCSV(projectExport), { name: "prompts.csv" });
      archive.append(generateEndpointsCSV(projectExport), { name: "endpoints.csv" });
      archive.append(generateTestCasesCSV(projectExport.testSuites), {
        name: "test_cases.csv",
      });
      archive.append(generateTestResultsCSV(projectExport.testSuites), {
        name: "test_results.csv",
      });
      archive.append(generateSummaryCSV(projectExport), { name: "summary.csv" });
      archive.append(generateWebhooksCSV(projectExport), { name: "webhooks.csv" });
    } else {
      // Single test suite export
      const suiteExport = data as TestSuiteOnlyExport;

      // Add metadata
      archive.append(
        JSON.stringify(suiteExport.metadata, null, 2),
        { name: "metadata.json" }
      );

      // Add target info
      archive.append(
        JSON.stringify(suiteExport.target, null, 2),
        { name: "target.json" }
      );

      // Add CSVs
      archive.append(generateTestCasesCSV([suiteExport.testSuite], false), {
        name: "test_cases.csv",
      });
      archive.append(generateTestResultsCSV([suiteExport.testSuite]), {
        name: "test_results.csv",
      });
      archive.append(generateSummaryCSV(suiteExport), { name: "summary.csv" });
    }

    archive.finalize();
  });
}
