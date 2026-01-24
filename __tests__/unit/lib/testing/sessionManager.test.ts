import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EndpointSessionManager } from '@/lib/testing/sessionManager';
import { ISessionConfig } from '@/lib/db/models/testSuite';

describe('EndpointSessionManager', () => {
  describe('cookie persistence', () => {
    it('should extract and store cookies from Set-Cookie header', () => {
      const config: ISessionConfig = {
        enabled: true,
        persistCookies: true,
      };

      const manager = new EndpointSessionManager(config);

      // Create a mock response with Set-Cookie header
      const mockResponse = {
        headers: {
          get: (name: string) => name === 'set-cookie' ? 'sessionId=abc123; Path=/; HttpOnly' : null,
          getSetCookie: () => ['sessionId=abc123; Path=/; HttpOnly'],
        },
      } as unknown as Response;

      manager.processResponse(mockResponse, {});

      const cookies = manager.getCookies();
      expect(cookies.sessionId).toBe('abc123');
    });

    it('should apply cookies to subsequent requests', () => {
      const config: ISessionConfig = {
        enabled: true,
        persistCookies: true,
      };

      const manager = new EndpointSessionManager(config);

      // Simulate having stored cookies
      const mockResponse = {
        headers: {
          get: () => null,
          getSetCookie: () => ['sessionId=abc123; Path=/'],
        },
      } as unknown as Response;
      manager.processResponse(mockResponse, {});

      // Apply to next request
      const result = manager.applyToRequest({}, '{}', 'https://api.example.com/test');

      expect(result.headers['Cookie']).toBe('sessionId=abc123');
    });

    it('should handle multiple cookies', () => {
      const config: ISessionConfig = {
        enabled: true,
        persistCookies: true,
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: {
          get: () => null,
          getSetCookie: () => [
            'sessionId=abc123; Path=/',
            'userId=user456; Path=/',
          ],
        },
      } as unknown as Response;
      manager.processResponse(mockResponse, {});

      const result = manager.applyToRequest({}, '{}', 'https://api.example.com/test');

      expect(result.headers['Cookie']).toContain('sessionId=abc123');
      expect(result.headers['Cookie']).toContain('userId=user456');
    });
  });

  describe('token extraction', () => {
    it('should extract token from response using JSON path', () => {
      const config: ISessionConfig = {
        enabled: true,
        tokenExtraction: {
          enabled: true,
          responsePath: 'data.accessToken',
          injection: {
            type: 'header',
            target: 'Authorization',
            prefix: 'Bearer ',
          },
        },
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      const responseBody = {
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        },
      };

      manager.processResponse(mockResponse, responseBody);

      expect(manager.getToken()).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should inject token into header with prefix', () => {
      const config: ISessionConfig = {
        enabled: true,
        tokenExtraction: {
          enabled: true,
          responsePath: 'token',
          injection: {
            type: 'header',
            target: 'Authorization',
            prefix: 'Bearer ',
          },
        },
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      manager.processResponse(mockResponse, { token: 'abc123' });

      const result = manager.applyToRequest({}, '{}', 'https://api.example.com/test');

      expect(result.headers['Authorization']).toBe('Bearer abc123');
    });

    it('should inject token into query parameter', () => {
      const config: ISessionConfig = {
        enabled: true,
        tokenExtraction: {
          enabled: true,
          responsePath: 'token',
          injection: {
            type: 'query',
            target: 'access_token',
          },
        },
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      manager.processResponse(mockResponse, { token: 'abc123' });

      const result = manager.applyToRequest({}, '{}', 'https://api.example.com/test');

      expect(result.url).toBe('https://api.example.com/test?access_token=abc123');
    });

    it('should inject token into JSON body', () => {
      const config: ISessionConfig = {
        enabled: true,
        tokenExtraction: {
          enabled: true,
          responsePath: 'token',
          injection: {
            type: 'body',
            target: 'auth.token',
          },
        },
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      manager.processResponse(mockResponse, { token: 'abc123' });

      const result = manager.applyToRequest({}, '{"auth": {}}', 'https://api.example.com/test');

      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.auth.token).toBe('abc123');
    });
  });

  describe('variable extraction', () => {
    it('should extract variables from response', () => {
      const config: ISessionConfig = {
        enabled: true,
        variableExtraction: [
          { name: 'userId', responsePath: 'data.user.id' },
          { name: 'sessionId', responsePath: 'data.session' },
        ],
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      const responseBody = {
        data: {
          user: { id: 'user123' },
          session: 'sess456',
        },
      };

      manager.processResponse(mockResponse, responseBody);

      const variables = manager.getVariables();
      expect(variables.userId).toBe('user123');
      expect(variables.sessionId).toBe('sess456');
    });

    it('should handle missing paths gracefully', () => {
      const config: ISessionConfig = {
        enabled: true,
        variableExtraction: [
          { name: 'missing', responsePath: 'data.notexist' },
        ],
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: { get: () => null, getSetCookie: () => [] },
      } as unknown as Response;

      manager.processResponse(mockResponse, { data: {} });

      const variables = manager.getVariables();
      expect(variables.missing).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear all session state', () => {
      const config: ISessionConfig = {
        enabled: true,
        persistCookies: true,
        tokenExtraction: {
          enabled: true,
          responsePath: 'token',
          injection: { type: 'header', target: 'Authorization' },
        },
        variableExtraction: [{ name: 'var1', responsePath: 'value' }],
      };

      const manager = new EndpointSessionManager(config);

      const mockResponse = {
        headers: {
          get: () => null,
          getSetCookie: () => ['session=abc; Path=/'],
        },
      } as unknown as Response;

      manager.processResponse(mockResponse, { token: 'tok123', value: 'val456' });

      // Verify state is set
      expect(manager.getCookies().session).toBe('abc');
      expect(manager.getToken()).toBe('tok123');
      expect(manager.getVariables().var1).toBe('val456');

      // Reset
      manager.reset();

      // Verify state is cleared
      expect(Object.keys(manager.getCookies())).toHaveLength(0);
      expect(manager.getToken()).toBeNull();
      expect(Object.keys(manager.getVariables())).toHaveLength(0);
    });
  });
});
