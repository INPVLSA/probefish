/**
 * Client-side Server-Sent Events (SSE) parser
 * Parses SSE event streams from the test run endpoint
 */

export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface ConnectedEvent {
  runId: string;
  total: number;
  timestamp: string;
}

export interface ProgressEvent {
  current: number;
  total: number;
  iteration: number;
  testCaseId: string;
  testCaseName: string;
}

export interface ResultEvent {
  testCaseId: string;
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  judgeScores?: Record<string, number>;
  judgeReasoning?: string;
  judgeValidationPassed?: boolean;
  judgeValidationErrors?: string[];
  judgeValidationWarnings?: string[];
  responseTime: number;
  error?: string;
  iteration?: number;
}

export interface CompleteEvent {
  runId: string;
  status: "completed" | "incomplete";
  testRun: {
    _id: string;
    status: string;
    modelOverride?: {
      provider: string;
      model: string;
    };
    results: ResultEvent[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    };
  };
}

export interface ErrorEvent {
  message: string;
  code?: string;
  testCaseId?: string;
}

/**
 * Parses raw SSE text into structured events
 * Handles multiple events in a single chunk and partial events
 */
export function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = text.split("\n");

  let currentEvent: { type?: string; data?: string } = {};

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent.type = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      currentEvent.data = line.slice(6);
    } else if (line === "" && currentEvent.type && currentEvent.data !== undefined) {
      // Empty line signals end of event
      try {
        events.push({
          type: currentEvent.type,
          data: JSON.parse(currentEvent.data),
        });
      } catch {
        // If JSON parsing fails, use raw string
        events.push({
          type: currentEvent.type,
          data: currentEvent.data,
        });
      }
      currentEvent = {};
    }
  }

  return events;
}

/**
 * Type guard functions for SSE events
 */
export function isConnectedEvent(event: SSEEvent): event is SSEEvent & { data: ConnectedEvent } {
  return event.type === "connected";
}

export function isProgressEvent(event: SSEEvent): event is SSEEvent & { data: ProgressEvent } {
  return event.type === "progress";
}

export function isResultEvent(event: SSEEvent): event is SSEEvent & { data: ResultEvent } {
  return event.type === "result";
}

export function isCompleteEvent(event: SSEEvent): event is SSEEvent & { data: CompleteEvent } {
  return event.type === "complete";
}

export function isErrorEvent(event: SSEEvent): event is SSEEvent & { data: ErrorEvent } {
  return event.type === "error";
}

export function isHeartbeatEvent(event: SSEEvent): boolean {
  return event.type === "heartbeat";
}
