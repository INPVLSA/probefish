import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import Webhook from "@/lib/db/models/webhook";
import { deliverWebhook } from "@/lib/webhooks/delivery";

interface RouteParams {
  params: Promise<{ projectId: string; webhookId: string }>;
}

// POST /api/projects/[projectId]/webhooks/[webhookId]/test - Test webhook delivery
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const webhook = await Webhook.findOne({ _id: webhookId, projectId });
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Create test payload
    const testPayload = {
      event: "test.run.completed" as const,
      timestamp: new Date().toISOString(),
      test: true,
      project: {
        id: projectId,
        name: project.name,
      },
      testRun: {
        id: "test-run-id",
        suiteId: "test-suite-id",
        suiteName: "Test Suite",
        status: "completed",
        summary: {
          total: 5,
          passed: 4,
          failed: 1,
          avgScore: 85,
          avgResponseTime: 1234,
        },
      },
    };

    // Deliver webhook
    const result = await deliverWebhook(webhook, testPayload, "test.run.completed");

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      duration: result.duration,
      error: result.error,
      response: result.response?.slice(0, 500), // Limit response size
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    return NextResponse.json(
      { error: "Failed to test webhook" },
      { status: 500 }
    );
  }
}
