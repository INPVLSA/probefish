import Webhook, { WebhookEvent, IWebhook } from "@/lib/db/models/webhook";
import { deliverWebhook, recordDelivery, WebhookPayload } from "./delivery";

export interface TestRunData {
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
  previousRun?: {
    passed: number;
    failed: number;
  };
}

export interface ProjectData {
  id: string;
  name: string;
}

function detectRegressions(testRun: TestRunData): {
  hasRegressions: boolean;
  regressionCount: number;
  improvementCount: number;
} {
  if (!testRun.previousRun) {
    return { hasRegressions: false, regressionCount: 0, improvementCount: 0 };
  }

  const passedDelta = testRun.summary.passed - testRun.previousRun.passed;
  const failedDelta = testRun.summary.failed - testRun.previousRun.failed;

  return {
    hasRegressions: failedDelta > 0,
    regressionCount: Math.max(0, failedDelta),
    improvementCount: Math.max(0, passedDelta),
  };
}

export async function dispatchWebhooks(
  projectId: string,
  project: ProjectData,
  testRun: TestRunData
): Promise<{ dispatched: number; succeeded: number; failed: number }> {
  const stats = { dispatched: 0, succeeded: 0, failed: 0 };

  // Find active webhooks for this project
  const webhooks = await Webhook.find({
    projectId,
    status: "active",
  });

  if (webhooks.length === 0) {
    return stats;
  }

  const { hasRegressions, regressionCount, improvementCount } =
    detectRegressions(testRun);
  const hasFailed = testRun.summary.failed > 0;

  // Determine which events to trigger
  const eventsToTrigger: WebhookEvent[] = [];

  eventsToTrigger.push("test.run.completed");

  if (hasFailed) {
    eventsToTrigger.push("test.run.failed");
  }

  if (hasRegressions) {
    eventsToTrigger.push("test.regression.detected");
  }

  // Filter and dispatch webhooks
  for (const webhook of webhooks) {
    // Check if webhook should be triggered
    const shouldTrigger = shouldTriggerWebhook(
      webhook,
      eventsToTrigger,
      testRun.suiteId,
      hasFailed,
      hasRegressions
    );

    if (!shouldTrigger.trigger) {
      continue;
    }

    // Build payload
    const payload: WebhookPayload = {
      event: shouldTrigger.event,
      timestamp: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
      },
      testRun: {
        id: testRun.id,
        suiteId: testRun.suiteId,
        suiteName: testRun.suiteName,
        status: testRun.status,
        summary: testRun.summary,
        regressions: regressionCount,
        improvements: improvementCount,
      },
    };

    stats.dispatched++;

    // Deliver webhook (async, don't block)
    deliverWebhook(webhook, payload, shouldTrigger.event)
      .then(async (result) => {
        await recordDelivery(webhook, result, shouldTrigger.event, payload);
        if (result.success) {
          stats.succeeded++;
        } else {
          stats.failed++;
        }
      })
      .catch((error) => {
        console.error(`Webhook delivery error for ${webhook._id}:`, error);
        stats.failed++;
      });
  }

  return stats;
}

function shouldTriggerWebhook(
  webhook: IWebhook,
  eventsToTrigger: WebhookEvent[],
  suiteId: string,
  hasFailed: boolean,
  hasRegressions: boolean
): { trigger: boolean; event: WebhookEvent } {
  // Check suite filter
  if (webhook.suiteIds && webhook.suiteIds.length > 0) {
    const suiteMatches = webhook.suiteIds.some(
      (id) => id.toString() === suiteId
    );
    if (!suiteMatches) {
      return { trigger: false, event: "test.run.completed" };
    }
  }

  // Check failure filter
  if (webhook.onlyOnFailure && !hasFailed) {
    return { trigger: false, event: "test.run.completed" };
  }

  // Check regression filter
  if (webhook.onlyOnRegression && !hasRegressions) {
    return { trigger: false, event: "test.run.completed" };
  }

  // Find matching event (prioritize most specific)
  const eventPriority: WebhookEvent[] = [
    "test.regression.detected",
    "test.run.failed",
    "test.run.completed",
  ];

  for (const event of eventPriority) {
    if (webhook.events.includes(event) && eventsToTrigger.includes(event)) {
      return { trigger: true, event };
    }
  }

  return { trigger: false, event: "test.run.completed" };
}
