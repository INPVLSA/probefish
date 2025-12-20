import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: object;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {}, cookies = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
  }

  const request = new NextRequest(new URL(url, 'http://localhost:3000'), requestInit as ConstructorParameters<typeof NextRequest>[1]);

  // Set cookies
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }

  return request;
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Create authorization header with JWT token
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Create a mock session cookie value (for testing authenticated routes)
 */
export function createSessionCookie(token: string): Record<string, string> {
  return {
    session: token,
  };
}
