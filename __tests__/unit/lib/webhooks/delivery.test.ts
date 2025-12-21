import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { deliverWebhook, WebhookPayload } from "@/lib/webhooks/delivery";
import { IWebhook, WebhookEvent } from "@/lib/db/models/webhook";

describe("Webhook Delivery", () => {
  const mockWebhook = {
    _id: "webhook-id",
    name: "Test Webhook",
    projectId: "project-id",
    url: "https://example.com/webhook",
    secret: "test-secret",
    events: ["test.run.completed"] as WebhookEvent[],
    status: "active",
    headers: new Map([["X-Custom-Header", "custom-value"]]),
    retryCount: 2,
    retryDelayMs: 100,
    consecutiveFailures: 0,
    deliveryHistory: [],
  } as unknown as IWebhook;

  const mockPayload: WebhookPayload = {
    event: "test.run.completed",
    timestamp: new Date().toISOString(),
    project: {
      id: "project-id",
      name: "Test Project",
    },
    testRun: {
      id: "run-id",
      suiteId: "suite-id",
      suiteName: "Test Suite",
      status: "completed",
      summary: {
        total: 10,
        passed: 8,
        failed: 2,
        avgScore: 85,
        avgResponseTime: 1500,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deliverWebhook", () => {
    it("should successfully deliver webhook on 200 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      const result = await deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.response).toBe("OK");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should include correct headers in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      await deliverWebhook(mockWebhook, mockPayload, "test.run.completed");

      expect(mockFetch).toHaveBeenCalledWith(
        mockWebhook.url,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": "Probefish-Webhook/1.0",
            "X-Webhook-Event": "test.run.completed",
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });

    it("should include signature header when secret is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      await deliverWebhook(mockWebhook, mockPayload, "test.run.completed");

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it("should return failure on 4xx response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid payload"),
      });

      const result = await deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("HTTP 400: Bad Request");
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry on 4xx
    });

    it("should retry on 5xx response", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Server error"),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("OK"),
        });

      const resultPromise = deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      // Advance timers for retry delay
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on network error", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("OK"),
        });

      const resultPromise = deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const resultPromise = deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should not retry when retryCount is 0", async () => {
      const noRetryWebhook = { ...mockWebhook, retryCount: 0 } as unknown as IWebhook;
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await deliverWebhook(
        noRetryWebhook,
        mockPayload,
        "test.run.completed"
      );

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should track duration", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      const result = await deliverWebhook(
        mockWebhook,
        mockPayload,
        "test.run.completed"
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
