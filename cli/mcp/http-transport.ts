import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { validateBearerToken } from '../lib/api-client.js';

export interface HttpServerOptions {
  port: number;
  baseUrl: string;
  noAuth?: boolean;
}

export interface HttpServerContext {
  server: ReturnType<typeof createServer>;
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
}

function log(message: string): void {
  process.stderr.write(`[probefish-mcp-http] ${message}\n`);
}

// Cache for validated tokens (simple in-memory cache with TTL)
const tokenCache = new Map<string, { valid: boolean; expires: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function isTokenValid(token: string, baseUrl: string): Promise<boolean> {
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.valid;
  }

  const valid = await validateBearerToken(token, baseUrl);
  tokenCache.set(token, { valid, expires: Date.now() + TOKEN_CACHE_TTL });
  return valid;
}

export function createHttpMcpServer(options: HttpServerOptions): HttpServerContext {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      log(`Session initialized: ${sessionId}`);
    },
  });

  const server = createServer(async (req, res) => {
    // CORS headers for web clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token authentication (unless --no-auth)
    if (!options.noAuth) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing Bearer token' }));
        return;
      }

      const providedToken = authHeader.slice(7);
      const valid = await isTokenValid(providedToken, options.baseUrl);
      if (!valid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }
    }

    // Parse body for POST requests
    let body: unknown;
    if (req.method === 'POST') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        body = rawBody ? JSON.parse(rawBody) : undefined;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }

    // Delegate to MCP transport
    try {
      await transport.handleRequest(req, res, body);
    } catch (error) {
      log(`Transport error: ${error}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  const close = async (): Promise<void> => {
    await transport.close();
    return new Promise((resolve) => server.close(() => resolve()));
  };

  return { server, transport, close };
}
