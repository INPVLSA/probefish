// CLI Configuration
export interface CLIConfig {
  token?: string;
  baseUrl?: string;
  output: {
    format: 'table' | 'json';
    color: boolean;
  };
}

// API Response Types
export interface ApiError {
  error: string;
}

export interface Project {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  organizationId: string;
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface TestSuite {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  projectId: string;
  targetType: 'prompt' | 'endpoint';
  targetId: string;
  testCases: TestCase[];
  lastRun?: TestRun;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  _id: string;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface TestRun {
  _id: string;
  runAt: string;
  status: 'running' | 'completed' | 'failed';
  note?: string;
  iterations?: number;
  modelOverride?: {
    provider: string;
    model: string;
  };
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

export interface TestResult {
  testCaseId: string;
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  judgeReasoning?: string;
  responseTime: number;
  error?: string;
  iteration?: number;
}

// API Response wrappers
export interface ProjectsResponse {
  projects: Project[];
}

export interface TestSuitesResponse {
  testSuites: TestSuite[];
}

export interface TestRunsResponse {
  runs: TestRun[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RunTestSuiteResponse {
  success: boolean;
  testRun: TestRun;
}

// Run command options
export interface RunOptions {
  project: string;
  iterations?: number;
  model?: string;
  output?: 'table' | 'json' | 'junit';
  outputFile?: string;
  quiet?: boolean;
}

// List command options
export interface ListOptions {
  project?: string;
  suite?: string;
  format?: 'table' | 'json';
  limit?: number;
}

// Export command options
export interface ExportOptions {
  project: string;
  suite?: string;
  format?: 'json' | 'junit' | 'csv';
  output?: string;
}
