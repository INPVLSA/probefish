import { collectProjectData } from "./collectors/project";
import { collectTestSuiteData } from "./collectors/testSuite";
import { toJSON } from "./formats/json";
import { toJUnit } from "./formats/junit";
import { toCSV } from "./formats/csv";
import { ExportFormat, ExportOptions, ProjectExport, TestSuiteOnlyExport } from "./types";

export interface ExportResult {
  data: string | Buffer;
  filename: string;
  contentType: string;
}

export async function exportProject(
  projectId: string,
  format: ExportFormat = "json",
  options: ExportOptions = {}
): Promise<ExportResult> {
  const projectData = await collectProjectData(projectId, options);
  const projectSlug = projectData.project.name.toLowerCase().replace(/\s+/g, "-");
  const timestamp = new Date().toISOString().split("T")[0];

  switch (format) {
    case "json":
      return {
        data: toJSON(projectData),
        filename: `${projectSlug}-export-${timestamp}.json`,
        contentType: "application/json",
      };

    case "junit":
      return {
        data: toJUnit(projectData),
        filename: `${projectSlug}-results-${timestamp}.xml`,
        contentType: "application/xml",
      };

    case "csv":
      return {
        data: await toCSV(projectData),
        filename: `${projectSlug}-export-${timestamp}.zip`,
        contentType: "application/zip",
      };

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export async function exportTestSuite(
  projectId: string,
  suiteId: string,
  format: ExportFormat = "json",
  options: ExportOptions = {}
): Promise<ExportResult> {
  const suiteData = await collectTestSuiteData(projectId, suiteId, options);
  const suiteSlug = suiteData.testSuite.name.toLowerCase().replace(/\s+/g, "-");
  const timestamp = new Date().toISOString().split("T")[0];

  switch (format) {
    case "json":
      return {
        data: toJSON(suiteData),
        filename: `${suiteSlug}-export-${timestamp}.json`,
        contentType: "application/json",
      };

    case "junit":
      return {
        data: toJUnit(suiteData),
        filename: `${suiteSlug}-results-${timestamp}.xml`,
        contentType: "application/xml",
      };

    case "csv":
      return {
        data: await toCSV(suiteData),
        filename: `${suiteSlug}-export-${timestamp}.zip`,
        contentType: "application/zip",
      };

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export type { ExportFormat, ExportOptions, ProjectExport, TestSuiteOnlyExport };
