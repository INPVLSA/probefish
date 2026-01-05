import crypto from "crypto";
import { IWebhook, WebhookEvent, IWebhookDelivery } from "@/lib/db/models/webhook";
import { isAllowedWebhookUrl } from "./validation";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  test?: boolean;
  project: {
    id: string;
    name: string;
  };
  testRun: {
    id: string;
    suiteId: string;
    suiteName: string;
    status: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    };
    regressions?: number;
    improvements?: number;
  };
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  duration: number;
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deliverWebhook(
  webhook: IWebhook,
  payload: WebhookPayload,
  event: WebhookEvent,
  retry = 0
): Promise<DeliveryResult> {
  // SSRF protection: validate URL before making request
  if (!isAllowedWebhookUrl(webhook.url)) {
    return {
      success: false,
      error: "Webhook URL is not allowed (internal or private address)",
      duration: 0,
    };
  }

  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Probefish-Webhook/1.0",
      "X-Webhook-Event": event,
      "X-Webhook-Delivery": crypto.randomUUID(),
      "X-Webhook-Timestamp": new Date().toISOString(),
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      headers["X-Webhook-Signature"] = `sha256=${generateSignature(
        payloadString,
        webhook.secret
      )}`;
    }

    // Add custom headers
    if (webhook.headers) {
      const customHeaders =
        webhook.headers instanceof Map
          ? Object.fromEntries(webhook.headers)
          : webhook.headers;
      Object.assign(headers, customHeaders);
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text().catch(() => "");

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        response: responseText,
        duration,
      };
    }

    // Retry on server errors (5xx)
    if (response.status >= 500 && retry < webhook.retryCount) {
      await sleep(webhook.retryDelayMs * Math.pow(2, retry)); // Exponential backoff
      return deliverWebhook(webhook, payload, event, retry + 1);
    }

    return {
      success: false,
      statusCode: response.status,
      response: responseText,
      error: `HTTP ${response.status}: ${response.statusText}`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Retry on network errors
    if (retry < webhook.retryCount) {
      await sleep(webhook.retryDelayMs * Math.pow(2, retry));
      return deliverWebhook(webhook, payload, event, retry + 1);
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

export async function recordDelivery(
  webhook: IWebhook,
  result: DeliveryResult,
  event: WebhookEvent,
  payload: WebhookPayload
): Promise<void> {
  const delivery: Partial<IWebhookDelivery> = {
    event,
    payload: payload as unknown as Record<string, unknown>,
    statusCode: result.statusCode,
    response: result.response?.slice(0, 1000), // Limit stored response
    error: result.error,
    deliveredAt: new Date(),
    duration: result.duration,
    success: result.success,
  };

  webhook.deliveryHistory.push(delivery as IWebhookDelivery);
  webhook.lastDelivery = new Date();

  if (result.success) {
    webhook.lastSuccess = new Date();
    webhook.consecutiveFailures = 0;
  } else {
    webhook.lastFailure = new Date();
    webhook.consecutiveFailures += 1;

    // Auto-disable after 10 consecutive failures
    if (webhook.consecutiveFailures >= 10) {
      webhook.status = "failed";
    }
  }

  await webhook.save();
}
