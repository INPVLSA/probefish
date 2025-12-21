import { z } from "zod";

// Metadata schema
export const ExportMetadataSchema = z.object({
  version: z.literal("1.0"),
  exportedAt: z.string(),
  format: z.enum(["json", "junit", "csv"]),
  source: z.literal("probefish"),
  projectId: z.string(),
  projectName: z.string(),
  scope: z.enum(["project", "test-suite"]),
  suiteId: z.string().optional(),
  suiteName: z.string().optional(),
});

// Model config schema
export const ModelConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "custom"]).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

// Prompt version schema
export const PromptVersionSchema = z.object({
  version: z.number().positive(),
  content: z.string(),
  systemPrompt: z.string().optional(),
  variables: z.array(z.string()).default([]),
  modelConfig: ModelConfigSchema,
  note: z.string().optional(),
  createdAt: z.string().optional(),
});

// Prompt schema
export const PromptExportSchema = z.object({
  _exportId: z.string(),
  name: z.string().min(1, "Prompt name is required"),
  description: z.string().optional(),
  versions: z.array(PromptVersionSchema).min(1, "At least one version required"),
  currentVersion: z.number().positive(),
  tags: z.array(z.string()).default([]),
});

// Endpoint config schema
export const EndpointConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().url("Invalid URL"),
  headers: z.record(z.string(), z.string()).optional(),
  auth: z.object({
    type: z.enum(["none", "bearer", "apiKey", "basic"]),
  }).optional(),
  bodyTemplate: z.string().optional(),
  contentType: z.string().optional(),
  responseContentPath: z.string().optional(),
});

// Endpoint schema
export const EndpointExportSchema = z.object({
  _exportId: z.string(),
  name: z.string().min(1, "Endpoint name is required"),
  description: z.string().optional(),
  config: EndpointConfigSchema,
  variables: z.array(z.string()).default([]),
});

// Test case schema
export const TestCaseSchema = z.object({
  name: z.string().min(1, "Test case name is required"),
  inputs: z.record(z.string(), z.string()).default({}),
  expectedOutput: z.string().optional(),
  notes: z.string().optional(),
});

// Validation rule schema
export const ValidationRuleSchema = z.object({
  type: z.enum([
    "contains",
    "excludes",
    "minLength",
    "maxLength",
    "regex",
    "jsonSchema",
    "maxResponseTime",
  ]),
  value: z.union([z.string(), z.number()]),
  message: z.string().optional(),
  severity: z.enum(["fail", "warning"]).default("fail"),
});

// Judge criterion schema
export const JudgeCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  weight: z.number().min(0).max(100),
});

// Judge validation rule schema
export const JudgeValidationRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  failureMessage: z.string().optional(),
  severity: z.enum(["fail", "warning"]),
});

// LLM Judge config schema
export const LLMJudgeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(["openai", "anthropic", "gemini"]).optional(),
  model: z.string().optional(),
  criteria: z.array(JudgeCriterionSchema).default([]),
  validationRules: z.array(JudgeValidationRuleSchema).default([]),
  minScore: z.number().min(0).max(100).optional(),
});

// Test run summary schema
export const TestRunSummarySchema = z.object({
  total: z.number().nonnegative(),
  passed: z.number().nonnegative(),
  failed: z.number().nonnegative(),
  avgScore: z.number().optional(),
  avgResponseTime: z.number().nonnegative(),
});

// Test result schema
export const TestResultSchema = z.object({
  testCaseName: z.string(),
  inputs: z.record(z.string(), z.string()).default({}),
  output: z.string(),
  validationPassed: z.boolean(),
  validationErrors: z.array(z.string()).default([]),
  judgeScore: z.number().optional(),
  judgeScores: z.record(z.string(), z.number()).optional(),
  judgeReasoning: z.string().optional(),
  responseTime: z.number().nonnegative(),
  error: z.string().optional(),
});

// Test run schema
export const TestRunSchema = z.object({
  runAt: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  results: z.array(TestResultSchema).default([]),
  summary: TestRunSummarySchema,
});

// Test suite schema
export const TestSuiteExportSchema = z.object({
  _exportId: z.string(),
  name: z.string().min(1, "Test suite name is required"),
  description: z.string().optional(),
  targetType: z.enum(["prompt", "endpoint"]),
  targetRef: z.string(),
  targetVersion: z.number().optional(),
  testCases: z.array(TestCaseSchema).default([]),
  validationRules: z.array(ValidationRuleSchema).default([]),
  llmJudgeConfig: LLMJudgeConfigSchema,
  runHistory: z.array(TestRunSchema).optional(),
});

// Webhook schema
export const WebhookExportSchema = z.object({
  name: z.string().min(1, "Webhook name is required"),
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.enum(["test.run.completed", "test.run.failed", "test.regression.detected"])).min(1, "At least one event required"),
  status: z.enum(["active", "inactive"]),
  suiteRefs: z.array(z.string()).optional(),
  onlyOnFailure: z.boolean().optional(),
  onlyOnRegression: z.boolean().optional(),
  retryCount: z.number().nonnegative().default(3),
  retryDelayMs: z.number().nonnegative().default(1000),
});

// Project info schema
export const ProjectInfoSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  visibility: z.enum(["public", "private"]),
});

// Full project export schema
export const ProjectExportSchema = z.object({
  metadata: ExportMetadataSchema,
  project: ProjectInfoSchema,
  prompts: z.array(PromptExportSchema).default([]),
  endpoints: z.array(EndpointExportSchema).default([]),
  testSuites: z.array(TestSuiteExportSchema).default([]),
  webhooks: z.array(WebhookExportSchema).default([]),
});

// Single test suite export schema
export const TestSuiteOnlyExportSchema = z.object({
  metadata: ExportMetadataSchema,
  testSuite: TestSuiteExportSchema,
  target: z.object({
    type: z.enum(["prompt", "endpoint"]),
    data: z.union([PromptExportSchema, EndpointExportSchema]),
  }),
});

// Validation functions
export function validateProjectExport(data: unknown) {
  return ProjectExportSchema.safeParse(data);
}

export function validateTestSuiteExport(data: unknown) {
  return TestSuiteOnlyExportSchema.safeParse(data);
}

// Format Zod errors into ImportError format
export function formatZodErrors(
  zodError: z.ZodError<unknown>
): Array<{ path: string; message: string; code: string }> {
  return zodError.issues.map((err) => ({
    path: err.path.join("."),
    message: err.message,
    code: err.code,
  }));
}
