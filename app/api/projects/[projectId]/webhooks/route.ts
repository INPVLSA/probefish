import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Webhook from "@/lib/db/models/webhook";
import { isAllowedWebhookUrl } from "@/lib/webhooks/validation";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/webhooks - List all webhooks
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

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

    const webhooks = await Webhook.find({ projectId })
      .select("-secret -deliveryHistory.payload -deliveryHistory.response")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/webhooks - Create a webhook
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

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

    const body = await request.json();
    const {
      name,
      url,
      events,
      secret,
      headers,
      suiteIds,
      onlyOnFailure,
      onlyOnRegression,
      retryCount,
      retryDelayMs,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Webhook name is required" },
        { status: 400 }
      );
    }

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

    if (!events || !Array.isArray(events) || events.length === 0) {
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

    // Generate secret if not provided
    const webhookSecret = secret?.trim() || crypto.randomBytes(32).toString("hex");

    const webhook = await Webhook.create({
      name: name.trim(),
      projectId,
      url: url.trim(),
      events,
      secret: webhookSecret,
      headers: headers || {},
      suiteIds: suiteIds || [],
      onlyOnFailure: onlyOnFailure || false,
      onlyOnRegression: onlyOnRegression || false,
      retryCount: retryCount ?? 3,
      retryDelayMs: retryDelayMs ?? 1000,
      createdBy: auth.context.user.id,
    });

    // Return webhook with secret only on creation
    return NextResponse.json(
      {
        webhook: {
          _id: webhook._id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhookSecret,
          status: webhook.status,
          headers: webhook.headers,
          suiteIds: webhook.suiteIds,
          onlyOnFailure: webhook.onlyOnFailure,
          onlyOnRegression: webhook.onlyOnRegression,
          retryCount: webhook.retryCount,
          retryDelayMs: webhook.retryDelayMs,
          createdAt: webhook.createdAt,
        },
        message: "Webhook created successfully. Save the secret - it won't be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}
