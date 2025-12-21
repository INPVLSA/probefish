import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the delivery module
vi.mock("@/lib/webhooks/delivery", () => ({
  deliverWebhook: vi.fn(() =>
    Promise.resolve({
      success: true,
      statusCode: 200,
      duration: 100,
    })
  ),
  recordDelivery: vi.fn(() => Promise.resolve(undefined)),
}));

// Mock the webhook model
vi.mock("@/lib/db/models/webhook", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Webhook from "@/lib/db/models/webhook";
import { deliverWebhook, recordDelivery } from "@/lib/webhooks/delivery";
import { dispatchWebhooks, TestRunData, ProjectData } from "@/lib/webhooks/dispatcher";

describe("Webhook Dispatcher", () => {
  const mockProject: ProjectData = {
    id: "project-123",
    name: "Test Project",
  };

  const mockTestRun: TestRunData = {
    id: "run-123",
    suiteId: "suite-123",
    suiteName: "Test Suite",
    status: "completed",
    summary: {
      total: 10,
      passed: 8,
      failed: 2,
      avgScore: 85,
      avgResponseTime: 1500,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dispatchWebhooks", () => {
    it("should return zero counts when no webhooks exist", async () => {
      vi.mocked(Webhook.find).mockResolvedValueOnce([]);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should dispatch to webhooks listening for test.run.completed", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(1);
      expect(deliverWebhook).toHaveBeenCalledTimes(1);
    });

    it("should dispatch to webhooks listening for test.run.failed when tests fail", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.failed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const failedTestRun = {
        ...mockTestRun,
        summary: { ...mockTestRun.summary, failed: 5 },
      };

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        failedTestRun
      );

      expect(result.dispatched).toBe(1);
      expect(deliverWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: "test.run.failed" }),
        "test.run.failed"
      );
    });

    it("should dispatch to webhooks listening for test.regression.detected when regressions occur", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.regression.detected"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const regressedTestRun: TestRunData = {
        ...mockTestRun,
        previousRun: { passed: 10, failed: 0 }, // Previous run had all passing
      };

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        regressedTestRun
      );

      expect(result.dispatched).toBe(1);
      expect(deliverWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: "test.regression.detected" }),
        "test.regression.detected"
      );
    });

    it("should filter webhooks by suite ID", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [{ toString: () => "other-suite" }],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(0);
      expect(deliverWebhook).not.toHaveBeenCalled();
    });

    it("should match webhooks with matching suite ID", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [{ toString: () => "suite-123" }],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(1);
    });

    it("should respect onlyOnFailure filter", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: true,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      // Test run with all passing tests
      const passingTestRun = {
        ...mockTestRun,
        summary: { ...mockTestRun.summary, failed: 0 },
      };

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        passingTestRun
      );

      expect(result.dispatched).toBe(0);
    });

    it("should trigger onlyOnFailure webhook when tests fail", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: true,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun // Has 2 failed tests
      );

      expect(result.dispatched).toBe(1);
    });

    it("should respect onlyOnRegression filter", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: true,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      // No previous run - can't detect regression
      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(0);
    });

    it("should include regression and improvement counts in payload", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.regression.detected"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const regressedTestRun: TestRunData = {
        ...mockTestRun,
        summary: { ...mockTestRun.summary, passed: 7, failed: 3 },
        previousRun: { passed: 9, failed: 1 },
      };

      await dispatchWebhooks(mockProject.id, mockProject, regressedTestRun);

      expect(deliverWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          testRun: expect.objectContaining({
            regressions: 2,
            improvements: 0,
          }),
        }),
        expect.anything()
      );
    });

    it("should dispatch to multiple webhooks", async () => {
      const mockWebhooks = [
        {
          _id: "webhook-1",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
        {
          _id: "webhook-2",
          events: ["test.run.completed"],
          status: "active",
          suiteIds: [],
          onlyOnFailure: false,
          onlyOnRegression: false,
        },
      ];
      vi.mocked(Webhook.find).mockResolvedValueOnce(mockWebhooks as never);

      const result = await dispatchWebhooks(
        mockProject.id,
        mockProject,
        mockTestRun
      );

      expect(result.dispatched).toBe(2);
      expect(deliverWebhook).toHaveBeenCalledTimes(2);
    });
  });
});
