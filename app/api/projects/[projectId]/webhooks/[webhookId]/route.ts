import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Webhook from "@/lib/db/models/webhook";
import { isAllowedWebhookUrl } from "@/lib/webhooks/validation";

interface RouteParams {
  params: Promise<{ projectId: string; webhookId: string }>;
}

// GET /api/projects/[projectId]/webhooks/[webhookId] - Get webhook details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId, webhookId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const webhook = await Webhook.findOne({ _id: webhookId, projectId })
      .select("-secret")
      .lean();

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("Error fetching webhook:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId]/webhooks/[webhookId] - Update webhook
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId, webhookId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.EDIT,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const webhook = await Webhook.findOne({ _id: webhookId, projectId });
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      url,
      events,
      headers,
      suiteIds,
      onlyOnFailure,
      onlyOnRegression,
      retryCount,
      retryDelayMs,
      status,
    } = body;

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Webhook name is required" },
          { status: 400 }
        );
      }
      webhook.name = name.trim();
    }

    if (url !== undefined) {
      if (!url?.trim()) {
        return NextResponse.json(
          { error: "Webhook URL is required" },
          { status: 400 }
        );
      }
      if (!isAllowedWebhookUrl(url.trim())) {
        return NextResponse.json(
          { error: "Webhook URL is not allowed. Cannot use localhost or private IP addresses." },
          { status: 400 }
        );
      }
      webhook.url = url.trim();
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: "At least one event must be selected" },
          { status: 400 }
        );
      }
      const validEvents = [
        "test.run.completed",
        "test.run.failed",
        "test.regression.detected",
      ];
      if (!events.every((e: string) => validEvents.includes(e))) {
        return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
      }
      webhook.events = events;
    }

    if (headers !== undefined) {
      webhook.headers = headers;
    }

    if (suiteIds !== undefined) {
      webhook.suiteIds = suiteIds;
    }

    if (onlyOnFailure !== undefined) {
      webhook.onlyOnFailure = onlyOnFailure;
    }

    if (onlyOnRegression !== undefined) {
      webhook.onlyOnRegression = onlyOnRegression;
    }

    if (retryCount !== undefined) {
      webhook.retryCount = Math.min(Math.max(retryCount, 0), 5);
    }

    if (retryDelayMs !== undefined) {
      webhook.retryDelayMs = Math.min(Math.max(retryDelayMs, 100), 60000);
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Use 'active' or 'inactive'" },
          { status: 400 }
        );
      }
      webhook.status = status;
      // Reset consecutive failures when reactivating
      if (status === "active") {
        webhook.consecutiveFailures = 0;
      }
    }

    await webhook.save();

    return NextResponse.json({
      webhook: {
        _id: webhook._id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        headers: webhook.headers,
        suiteIds: webhook.suiteIds,
        onlyOnFailure: webhook.onlyOnFailure,
        onlyOnRegression: webhook.onlyOnRegression,
        retryCount: webhook.retryCount,
        retryDelayMs: webhook.retryDelayMs,
        lastDelivery: webhook.lastDelivery,
        lastSuccess: webhook.lastSuccess,
        lastFailure: webhook.lastFailure,
        consecutiveFailures: webhook.consecutiveFailures,
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]/webhooks/[webhookId] - Delete webhook
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { projectId, webhookId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.MANAGE,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const webhook = await Webhook.findOneAndDelete({ _id: webhookId, projectId });
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Webhook deleted successfully" });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
