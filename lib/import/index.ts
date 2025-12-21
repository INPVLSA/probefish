import { previewImport, executeImport } from "./processors/json";
import { ImportOptions, ImportPreview, ImportResult } from "./types";

export async function previewProjectImport(
  projectId: string,
  data: unknown
): Promise<ImportPreview> {
  return previewImport(projectId, data);
}

export async function importProject(
  projectId: string,
  organizationId: string,
  userId: string,
  data: unknown,
  options: ImportOptions
): Promise<ImportResult> {
  return executeImport(projectId, organizationId, userId, data, options);
}

export type { ImportOptions, ImportPreview, ImportResult };
