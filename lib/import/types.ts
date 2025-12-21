// Import Type Definitions

export type ImportMode = "merge" | "replace";

export interface ImportOptions {
  mode: ImportMode;
  skipExisting?: boolean;
}

export interface ImportPreview {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  counts: ImportCounts;
  conflicts: ImportConflict[];
}

export interface ImportError {
  path: string;
  message: string;
  code: string;
}

export interface ImportWarning {
  path: string;
  message: string;
}

export interface ImportCounts {
  prompts: { new: number; existing: number; total: number };
  endpoints: { new: number; existing: number; total: number };
  testSuites: { new: number; existing: number; total: number };
  webhooks: { new: number; existing: number; total: number };
}

export interface ImportConflict {
  type: "prompt" | "endpoint" | "testSuite" | "webhook";
  name: string;
  exportId: string;
  existingId: string;
}

export interface ImportResult {
  success: boolean;
  counts: {
    prompts: { created: number; updated: number; skipped: number };
    endpoints: { created: number; updated: number; skipped: number };
    testSuites: { created: number; updated: number; skipped: number };
    webhooks: { created: number; updated: number; skipped: number };
  };
  errors: ImportError[];
  idMap: Map<string, string>;
}
