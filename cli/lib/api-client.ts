import { getToken, getBaseUrl } from './config.js';
import { AuthError, ConfigError, ApiError } from './errors.js';
import type {
  ProjectsResponse,
  TestSuitesResponse,
  TestRunsResponse,
  RunTestSuiteResponse,
  ApiError as ApiErrorResponse,
} from '../types.js';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new ConfigError(
      'API base URL not configured. Run: probefish config set api.baseUrl <url>'
    );
  }

  const token = getToken();
  if (!token) {
    throw new AuthError();
  }

  // Build URL with query params
  let url = `${baseUrl}${path}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiError(`Network error: ${error.message}`, 0);
    }
    throw new ApiError('Network error', 0);
  }

  // Handle binary responses (exports)
  const contentType = response.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/xml') ||
    contentType.includes('text/xml') ||
    contentType.includes('text/csv')
  ) {
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    return (await response.text()) as T;
  }

  // Handle JSON responses
  let data: T | ApiErrorResponse;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(`Invalid response from server`, response.status);
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    const message = errorData.error ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

// Projects
export async function listProjects(): Promise<ProjectsResponse> {
  return request<ProjectsResponse>('/projects');
}

// Test Suites
export async function listTestSuites(
  projectId: string,
  options?: { summary?: boolean }
): Promise<TestSuitesResponse> {
  return request<TestSuitesResponse>(`/projects/${projectId}/test-suites`, {
    params: {
      summary: options?.summary ? 'true' : undefined,
    },
  });
}

export async function getTestSuite(
  projectId: string,
  suiteId: string
): Promise<{ testSuite: TestSuitesResponse['testSuites'][0] }> {
  return request(`/projects/${projectId}/test-suites/${suiteId}`);
}

// Test Runs
export async function listTestRuns(
  projectId: string,
  suiteId: string,
  options?: { limit?: number; page?: number; summary?: boolean }
): Promise<TestRunsResponse> {
  return request<TestRunsResponse>(`/projects/${projectId}/test-suites/${suiteId}/runs`, {
    params: {
      limit: options?.limit,
      page: options?.page,
      summary: options?.summary ? 'true' : undefined,
    },
  });
}

export async function runTestSuite(
  projectId: string,
  suiteId: string,
  options?: {
    iterations?: number;
    modelOverride?: { provider: string; model: string };
    note?: string;
  }
): Promise<RunTestSuiteResponse> {
  return request<RunTestSuiteResponse>(`/projects/${projectId}/test-suites/${suiteId}/run`, {
    method: 'POST',
    body: {
      iterations: options?.iterations,
      modelOverride: options?.modelOverride,
      note: options?.note,
    },
  });
}

// Export
export async function exportTestSuite(
  projectId: string,
  suiteId: string,
  format: 'json' | 'junit' | 'csv' = 'json'
): Promise<string> {
  return request<string>(`/projects/${projectId}/test-suites/${suiteId}/export`, {
    params: { format },
  });
}

// Test Cases
export interface TestCaseInput {
  name: string;
  inputs?: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface AddTestCasesResponse {
  success: boolean;
  added: number;
  testCases: Array<{
    _id: string;
    name: string;
    inputs: Record<string, string>;
    expectedOutput: string;
    notes: string;
    tags: string[];
    enabled: boolean;
  }>;
}

export async function addTestCases(
  projectId: string,
  suiteId: string,
  testCases: TestCaseInput | TestCaseInput[]
): Promise<AddTestCasesResponse> {
  return request<AddTestCasesResponse>(
    `/projects/${projectId}/test-suites/${suiteId}/test-cases`,
    {
      method: 'POST',
      body: testCases,
    }
  );
}

export async function listTestCases(
  projectId: string,
  suiteId: string
): Promise<{ testCases: Array<{ _id: string; name: string; inputs: Record<string, string>; expectedOutput: string; enabled: boolean }> }> {
  return request(`/projects/${projectId}/test-suites/${suiteId}/test-cases`);
}

export async function getTestCase(
  projectId: string,
  suiteId: string,
  testCaseId: string
): Promise<{ testCase: { _id: string; name: string; inputs: Record<string, string>; expectedOutput: string; notes: string; tags: string[]; enabled: boolean } }> {
  return request(`/projects/${projectId}/test-suites/${suiteId}/test-cases/${testCaseId}`);
}

export async function updateTestCase(
  projectId: string,
  suiteId: string,
  testCaseId: string,
  updates: Partial<TestCaseInput>
): Promise<{ success: boolean; testCase: { _id: string; name: string; inputs: Record<string, string>; expectedOutput: string; notes: string; tags: string[]; enabled: boolean } }> {
  return request(`/projects/${projectId}/test-suites/${suiteId}/test-cases/${testCaseId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteTestCase(
  projectId: string,
  suiteId: string,
  testCaseId: string
): Promise<{ success: boolean; deleted: { _id: string; name: string } }> {
  return request(`/projects/${projectId}/test-suites/${suiteId}/test-cases/${testCaseId}`, {
    method: 'DELETE',
  });
}

// Auth validation - try to list projects to verify token
export async function validateToken(): Promise<boolean> {
  try {
    await listProjects();
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return false;
    }
    throw error;
  }
}
