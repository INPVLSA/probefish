import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth/session";
import Endpoint from "@/lib/db/models/endpoint";
import User from "@/lib/db/models/user";
import {
  resolveProjectAcrossOrgs,
  resolveEndpointByIdentifier,
} from "@/lib/utils/resolve-identifier";

interface RouteParams {
  params: Promise<{ projectId: string; endpointId: string }>;
}

// Helper to replace variables in a template
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }
  return result;
}

// Helper to get value from a nested path like "data.response.content"
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    // Handle array notation like "choices[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// POST /api/projects/[projectId]/endpoints/[endpointId]/test - Test an endpoint
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, endpointId } = await params;
    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Resolve project by ID or slug
    const project = await resolveProjectAcrossOrgs(projectId, user.organizationIds);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Resolve endpoint by ID or slug
    const endpoint = await resolveEndpointByIdentifier(endpointId, project._id);
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const body = await request.json();
    const { variables = {} } = body;

    const config = endpoint.config;
    const startTime = Date.now();

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": config.contentType || "application/json",
    };

    // Add custom headers
    if (config.headers) {
      const headersObj = config.headers instanceof Map
        ? Object.fromEntries(config.headers)
        : config.headers;
      Object.assign(headers, headersObj);
    }

    // Add authentication
    if (config.auth) {
      switch (config.auth.type) {
        case "bearer":
          if (config.auth.token) {
            headers["Authorization"] = `Bearer ${config.auth.token}`;
          }
          break;
        case "apiKey":
          if (config.auth.apiKeyHeader && config.auth.apiKey) {
            headers[config.auth.apiKeyHeader] = config.auth.apiKey;
          }
          break;
        case "basic":
          if (config.auth.username && config.auth.password) {
            const credentials = Buffer.from(
              `${config.auth.username}:${config.auth.password}`
            ).toString("base64");
            headers["Authorization"] = `Basic ${credentials}`;
          }
          break;
      }
    }

    // Build request body
    let requestBody: string | undefined;
    if (["POST", "PUT", "PATCH"].includes(config.method) && config.bodyTemplate) {
      requestBody = replaceVariables(config.bodyTemplate, variables);
    }

    try {
      // Make the actual HTTP request
      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: requestBody,
      });

      const responseTime = Date.now() - startTime;
      const responseStatus = response.status;
      const responseStatusText = response.statusText;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Try to parse response as JSON, fallback to text
      let responseBody: unknown;
      let responseText: string;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        responseText = await response.text();
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
      } else {
        responseText = await response.text();
        responseBody = responseText;
      }

      // Extract content using responseContentPath if specified
      let extractedContent: unknown = responseBody;
      if (config.responseContentPath && typeof responseBody === "object") {
        extractedContent = getValueByPath(responseBody, config.responseContentPath);
      }

      // Update endpoint test status
      endpoint.lastTestedAt = new Date();
      endpoint.lastTestStatus = response.ok ? "success" : "error";
      endpoint.lastTestError = response.ok ? undefined : `HTTP ${responseStatus}: ${responseStatusText}`;
      await endpoint.save();

      return NextResponse.json({
        success: response.ok,
        request: {
          method: config.method,
          url: config.url,
          headers: Object.fromEntries(
            Object.entries(headers).map(([k, v]) => [
              k,
              k.toLowerCase() === "authorization" ? "***" : v,
            ])
          ),
          body: requestBody,
        },
        response: {
          status: responseStatus,
          statusText: responseStatusText,
          headers: responseHeaders,
          body: responseBody,
          extractedContent,
        },
        timing: {
          responseTime,
        },
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";

      // Update endpoint test status
      endpoint.lastTestedAt = new Date();
      endpoint.lastTestStatus = "error";
      endpoint.lastTestError = errorMessage;
      await endpoint.save();

      return NextResponse.json({
        success: false,
        error: errorMessage,
        request: {
          method: config.method,
          url: config.url,
        },
      });
    }
  } catch (error) {
    console.error("Error testing endpoint:", error);
    return NextResponse.json(
      { error: "Failed to test endpoint" },
      { status: 500 }
    );
  }
}
