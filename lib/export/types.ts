// Export Type Definitions

export type ExportFormat = "json" | "junit" | "csv";
export type ExportScope = "project" | "test-suite";

export interface ExportMetadata {
  version: "1.0";
  exportedAt: string;
  format: ExportFormat;
  source: "probefish";
  projectId: string;
  projectName: string;
  scope: ExportScope;
  suiteId?: string;
  suiteName?: string;
}

export interface ProjectExport {
  metadata: ExportMetadata;
  project: ProjectInfo;
  prompts: PromptExport[];
  endpoints: EndpointExport[];
  testSuites: TestSuiteExport[];
  webhooks: WebhookExport[];
}

export interface ProjectInfo {
  name: string;
  description?: string;
  visibility: "public" | "private";
}

export interface PromptExport {
  _exportId: string;
  name: string;
  description?: string;
  versions: PromptVersionExport[];
  currentVersion: number;
  tags: string[];
}

export interface PromptVersionExport {
  version: number;
  content: string;
  systemPrompt?: string;
  variables: string[];
  modelConfig: ModelConfigExport;
  note?: string;
  createdAt?: string;
}

export interface ModelConfigExport {
  provider?: "openai" | "anthropic" | "gemini" | "custom";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface EndpointExport {
  _exportId: string;
  name: string;
  description?: string;
  config: EndpointConfigExport;
  variables: string[];
}

export interface EndpointConfigExport {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: "none" | "bearer" | "apiKey" | "basic";
    // Credentials excluded for security
  };
  bodyTemplate?: string;
  contentType?: string;
  responseContentPath?: string;
}

export interface TestSuiteExport {
  _exportId: string;
  name: string;
  description?: string;
  targetType: "prompt" | "endpoint";
  targetRef: string;
  targetVersion?: number;
  testCases: TestCaseExport[];
  validationRules: ValidationRuleExport[];
  llmJudgeConfig: LLMJudgeConfigExport;
  runHistory?: TestRunExport[];
}

export interface TestCaseExport {
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
}

export interface ValidationRuleExport {
  type:
    | "contains"
    | "excludes"
    | "minLength"
    | "maxLength"
    | "regex"
    | "jsonSchema"
    | "maxResponseTime"
    | "isJson"
    | "containsJson";
  value: string | number;
  message?: string;
  severity: "fail" | "warning";
}

export interface LLMJudgeConfigExport {
  enabled: boolean;
  provider?: "openai" | "anthropic" | "gemini";
  model?: string;
  criteria: JudgeCriterionExport[];
  validationRules: JudgeValidationRuleExport[];
  minScore?: number;
}

export interface JudgeCriterionExport {
  name: string;
  description: string;
  weight: number;
}

export interface JudgeValidationRuleExport {
  name: string;
  description: string;
  failureMessage?: string;
  severity: "fail" | "warning";
}

export interface TestRunExport {
  runAt: string;
  status: "running" | "completed" | "failed";
  results: TestResultExport[];
  summary: TestRunSummaryExport;
}

export interface TestRunSummaryExport {
  total: number;
  passed: number;
  failed: number;
  avgScore?: number;
  avgResponseTime: number;
}

export interface TestResultExport {
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  judgeScores?: Record<string, number>;
  judgeReasoning?: string;
  responseTime: number;
  error?: string;
}

export interface WebhookExport {
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  suiteRefs?: string[];
  onlyOnFailure?: boolean;
  onlyOnRegression?: boolean;
  retryCount: number;
  retryDelayMs: number;
}

// Single test suite export
export interface TestSuiteOnlyExport {
  metadata: ExportMetadata;
  testSuite: TestSuiteExport;
  target: {
    type: "prompt" | "endpoint";
    data: PromptExport | EndpointExport;
  };
}

// Export options
export interface ExportOptions {
  includeRunHistory?: boolean;
  runHistoryLimit?: number;
}
