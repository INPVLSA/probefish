/**
 * Server-Sent Events (SSE) helpers for streaming test results
 */

export type SSEEventType =
  | "connected"
  | "progress"
  | "result"
  | "heartbeat"
  | "complete"
  | "error";

export interface SSEStream {
  stream: TransformStream<Uint8Array, Uint8Array>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
}

/**
 * Creates a new SSE stream with writer and encoder
 */
export function createSSEStream(): SSEStream {
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  return { stream, writer, encoder };
}

/**
 * Sends an SSE event to the stream
 */
export async function sendSSEEvent(
  sse: SSEStream,
  event: SSEEventType,
  data: unknown
): Promise<void> {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  await sse.writer.write(sse.encoder.encode(message));
}

/**
 * Creates an SSE Response with appropriate headers
 */
export function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}

/**
 * Starts a heartbeat interval that sends periodic heartbeat events
 * Returns cleanup function to stop the heartbeat
 */
export function startHeartbeat(
  sse: SSEStream,
  intervalMs: number = 15000
): () => void {
  const intervalId = setInterval(async () => {
    try {
      await sendSSEEvent(sse, "heartbeat", {
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Stream closed, stop heartbeat
      clearInterval(intervalId);
    }
  }, intervalMs);

  return () => clearInterval(intervalId);
}

/**
 * Safely closes the SSE stream
 */
export async function closeSSEStream(sse: SSEStream): Promise<void> {
  try {
    await sse.writer.close();
  } catch {
    // Stream may already be closed
  }
}
