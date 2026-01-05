import Conf from 'conf';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CLIConfig } from '../types.js';

const CONFIG_SCHEMA = {
  token: { type: 'string' },
  baseUrl: { type: 'string' },
  output: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['table', 'json'], default: 'table' },
      color: { type: 'boolean', default: true },
    },
    default: { format: 'table', color: true },
  },
} as const;

const store = new Conf<CLIConfig>({
  projectName: 'probefish',
  schema: CONFIG_SCHEMA,
  defaults: {
    output: {
      format: 'table',
      color: true,
    },
  },
});

// Load .probefishrc from current directory if it exists
function loadProjectConfig(): Partial<CLIConfig> {
  const rcPath = join(process.cwd(), '.probefishrc');
  if (existsSync(rcPath)) {
    try {
      const content = readFileSync(rcPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Ignore invalid .probefishrc
    }
  }
  return {};
}

export function getToken(): string | undefined {
  // Priority: env var > .probefishrc > stored config
  if (process.env.PROBEFISH_TOKEN) {
    return process.env.PROBEFISH_TOKEN;
  }
  const projectConfig = loadProjectConfig();
  if (projectConfig.token) {
    return projectConfig.token;
  }
  return store.get('token');
}

export function setToken(token: string): void {
  store.set('token', token);
}

export function clearToken(): void {
  store.delete('token');
}

export function getBaseUrl(): string | undefined {
  // Priority: env var > .probefishrc > stored config
  if (process.env.PROBEFISH_BASE_URL) {
    return process.env.PROBEFISH_BASE_URL;
  }
  const projectConfig = loadProjectConfig();
  if (projectConfig.baseUrl) {
    return projectConfig.baseUrl;
  }
  return store.get('baseUrl');
}

export function setBaseUrl(url: string): void {
  store.set('baseUrl', url);
}

export function getOutputFormat(): 'table' | 'json' {
  const projectConfig = loadProjectConfig();
  if (projectConfig.output?.format) {
    return projectConfig.output.format;
  }
  return store.get('output.format') ?? 'table';
}

export function setOutputFormat(format: 'table' | 'json'): void {
  store.set('output.format', format);
}

export function getColorEnabled(): boolean {
  const projectConfig = loadProjectConfig();
  if (projectConfig.output?.color !== undefined) {
    return projectConfig.output.color;
  }
  return store.get('output.color') ?? true;
}

export function setColorEnabled(enabled: boolean): void {
  store.set('output.color', enabled);
}

export function getAllConfig(): CLIConfig {
  const projectConfig = loadProjectConfig();
  return {
    token: getToken(),
    baseUrl: getBaseUrl(),
    output: {
      format: projectConfig.output?.format ?? store.get('output.format') ?? 'table',
      color: projectConfig.output?.color ?? store.get('output.color') ?? true,
    },
  };
}

export function setConfigValue(key: string, value: string): boolean {
  switch (key) {
    case 'api.baseUrl':
      setBaseUrl(value);
      return true;
    case 'output.format':
      if (value === 'table' || value === 'json') {
        setOutputFormat(value);
        return true;
      }
      return false;
    case 'output.color':
      setColorEnabled(value === 'true');
      return true;
    default:
      return false;
  }
}

export function getConfigValue(key: string): string | undefined {
  switch (key) {
    case 'api.baseUrl':
      return getBaseUrl();
    case 'output.format':
      return getOutputFormat();
    case 'output.color':
      return String(getColorEnabled());
    case 'token':
      return getToken() ? '[set]' : undefined;
    default:
      return undefined;
  }
}

export const CONFIG_KEYS = ['api.baseUrl', 'output.format', 'output.color'] as const;
