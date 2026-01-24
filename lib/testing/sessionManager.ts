import { ISessionConfig } from "@/lib/db/models/testSuite";
import { getValueByPath } from "./executor";

/**
 * Manages session state for multi-turn endpoint testing.
 * Handles cookie persistence and token extraction/injection.
 */
export class EndpointSessionManager {
  private cookies: Map<string, string> = new Map();
  private extractedToken: string | null = null;
  private extractedVariables: Record<string, string> = {};

  constructor(private config: ISessionConfig) {}

  /**
   * Parse Set-Cookie headers and store cookies.
   */
  private parseCookies(setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      // Parse cookie name=value from Set-Cookie header
      // Format: name=value; Path=/; HttpOnly; ...
      const parts = header.split(";");
      if (parts.length > 0) {
        const cookiePart = parts[0].trim();
        const equalsIndex = cookiePart.indexOf("=");
        if (equalsIndex > 0) {
          const name = cookiePart.substring(0, equalsIndex).trim();
          const value = cookiePart.substring(equalsIndex + 1).trim();
          this.cookies.set(name, value);
        }
      }
    }
  }

  /**
   * Process response and extract session data (cookies, token, variables).
   */
  processResponse(response: Response, body: unknown): void {
    // Extract cookies if enabled
    if (this.config.persistCookies) {
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      // Fallback for environments without getSetCookie
      if (setCookieHeaders.length === 0) {
        const singleCookie = response.headers.get("set-cookie");
        if (singleCookie) {
          this.parseCookies([singleCookie]);
        }
      } else {
        this.parseCookies(setCookieHeaders);
      }
    }

    // Extract token if enabled
    if (this.config.tokenExtraction?.enabled && this.config.tokenExtraction.responsePath) {
      const token = getValueByPath(body, this.config.tokenExtraction.responsePath);
      if (typeof token === "string") {
        this.extractedToken = token;
      } else if (token !== null && token !== undefined) {
        this.extractedToken = String(token);
      }
    }

    // Extract variables for subsequent turns
    if (this.config.variableExtraction && Array.isArray(this.config.variableExtraction)) {
      for (const extraction of this.config.variableExtraction) {
        if (extraction.name && extraction.responsePath) {
          const value = getValueByPath(body, extraction.responsePath);
          if (value !== undefined && value !== null) {
            this.extractedVariables[extraction.name] = String(value);
          }
        }
      }
    }
  }

  /**
   * Apply session data (cookies, token) to the next request.
   * Returns modified headers, body, and URL.
   */
  applyToRequest(
    headers: Record<string, string>,
    bodyTemplate: string,
    url: string
  ): { headers: Record<string, string>; body: string; url: string } {
    const newHeaders = { ...headers };
    let newBody = bodyTemplate;
    let newUrl = url;

    // Apply cookies
    if (this.config.persistCookies && this.cookies.size > 0) {
      const cookieString = Array.from(this.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");

      // Merge with existing Cookie header if present
      if (newHeaders["Cookie"]) {
        newHeaders["Cookie"] = `${newHeaders["Cookie"]}; ${cookieString}`;
      } else {
        newHeaders["Cookie"] = cookieString;
      }
    }

    // Apply extracted token
    if (this.extractedToken && this.config.tokenExtraction?.injection) {
      const { type, target, prefix } = this.config.tokenExtraction.injection;
      const tokenValue = prefix ? `${prefix}${this.extractedToken}` : this.extractedToken;

      switch (type) {
        case "header":
          if (target) {
            newHeaders[target] = tokenValue;
          }
          break;

        case "body":
          if (target) {
            // Inject token into JSON body at specified path
            try {
              const bodyObj = JSON.parse(newBody);
              setValueByPath(bodyObj, target, tokenValue);
              newBody = JSON.stringify(bodyObj);
            } catch {
              // If body isn't valid JSON, leave it unchanged
              console.warn("Failed to inject token into body: body is not valid JSON");
            }
          }
          break;

        case "query":
          if (target) {
            // Append or replace query parameter
            const urlObj = new URL(newUrl);
            urlObj.searchParams.set(target, tokenValue);
            newUrl = urlObj.toString();
          }
          break;
      }
    }

    return { headers: newHeaders, body: newBody, url: newUrl };
  }

  /**
   * Get all extracted variables for use in variable substitution.
   */
  getVariables(): Record<string, string> {
    return { ...this.extractedVariables };
  }

  /**
   * Get the extracted token (for debugging/testing).
   */
  getToken(): string | null {
    return this.extractedToken;
  }

  /**
   * Get all stored cookies (for debugging/testing).
   */
  getCookies(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }

  /**
   * Reset session state.
   */
  reset(): void {
    this.cookies.clear();
    this.extractedToken = null;
    this.extractedVariables = {};
  }
}

/**
 * Helper to set a value at a nested path in an object.
 * Creates intermediate objects/arrays as needed.
 */
function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // Handle array notation like "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      if (!Array.isArray(current[key])) {
        current[key] = [];
      }
      const arr = current[key] as unknown[];
      if (arr[index] === undefined || arr[index] === null) {
        arr[index] = {};
      }
      current = arr[index] as Record<string, unknown>;
    } else {
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];

  // Handle array notation for the final part
  const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
  if (arrayMatch) {
    const [, key, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);

    if (!Array.isArray(current[key])) {
      current[key] = [];
    }
    (current[key] as unknown[])[index] = value;
  } else {
    current[lastPart] = value;
  }
}
