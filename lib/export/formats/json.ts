import { ProjectExport, TestSuiteOnlyExport } from "../types";

/**
 * Convert export data to JSON format
 * Full fidelity export for backup and migration
 */
export function toJSON(data: ProjectExport | TestSuiteOnlyExport): string {
  return JSON.stringify(data, null, 2);
}
