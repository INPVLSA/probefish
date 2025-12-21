import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import Project from "@/lib/db/models/project";
import Organization from "@/lib/db/models/organization";
import TestSuite, { ITestRun } from "@/lib/db/models/testSuite";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import { executeTestCase, toTestResult } from "@/lib/testing";
import { LLMProviderCredentials } from "@/lib/llm";
import { decrypt } from "@/lib/utils/encryption";
import { dispatchWebhooks } from "@/lib/webhooks/dispatcher";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// POST /api/projects/[projectId]/test-suites/[suiteId]/run - Execute test suite
// Supports: Session auth OR Token auth with "test-runs:execute" scope
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId, suiteId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request,
    ["test-runs:execute"] // Required scope for token auth
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const testSuite = await TestSuite.findOne({
      _id: suiteId,
      projectId,
    });

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    if (testSuite.testCases.length === 0) {
      return NextResponse.json(
        { error: "Test suite has no test cases" },
        { status: 400 }
      );
    }

    // Get organization to retrieve stored API keys
    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Decrypt stored API keys from organization
    const credentials: LLMProviderCredentials = {};

    if (organization.llmCredentials?.openai?.apiKey) {
      try {
        credentials.openaiApiKey = decrypt(organization.llmCredentials.openai.apiKey);
      } catch (e) {
        console.error("Failed to decrypt OpenAI key:", e);
      }
    }

    if (organization.llmCredentials?.anthropic?.apiKey) {
      try {
        credentials.anthropicApiKey = decrypt(organization.llmCredentials.anthropic.apiKey);
      } catch (e) {
        console.error("Failed to decrypt Anthropic key:", e);
      }
    }

    // Allow override from request body if provided
    const body = await request.json().catch(() => ({}));
    if (body.openaiApiKey) {
      credentials.openaiApiKey = body.openaiApiKey;
    }
    if (body.anthropicApiKey) {
      credentials.anthropicApiKey = body.anthropicApiKey;
    }

    // For prompt testing, verify we have required credentials
    if (testSuite.targetType === "prompt") {
      // Get the prompt to check which provider is needed
      const prompt = await Prompt.findById(testSuite.targetId);
      if (!prompt) {
        return NextResponse.json(
          { error: "Target prompt not found" },
          { status: 404 }
        );
      }

      const version = prompt.versions.find(
        (v) => v.version === (testSuite.targetVersion || prompt.currentVersion)
      );

      const provider = version?.modelConfig.provider || "openai";
      if (provider === "openai" && !credentials.openaiApiKey) {
        return NextResponse.json(
          { error: "OpenAI API key is required. Configure it in Settings > API Keys." },
          { status: 400 }
        );
      }
      if (provider === "anthropic" && !credentials.anthropicApiKey) {
        return NextResponse.json(
          { error: "Anthropic API key is required. Configure it in Settings > API Keys." },
          { status: 400 }
        );
      }
    }

    // For LLM judge, check credentials
    if (testSuite.llmJudgeConfig.enabled) {
      const judgeProvider = testSuite.llmJudgeConfig.provider || "openai";
      if (judgeProvider === "openai" && !credentials.openaiApiKey) {
        return NextResponse.json(
          { error: "OpenAI API key is required for LLM judge. Configure it in Settings > API Keys." },
          { status: 400 }
        );
      }
      if (judgeProvider === "anthropic" && !credentials.anthropicApiKey) {
        return NextResponse.json(
          { error: "Anthropic API key is required for LLM judge. Configure it in Settings > API Keys." },
          { status: 400 }
        );
      }
    }

    // Load the target
    let target;
    if (testSuite.targetType === "prompt") {
      target = await Prompt.findById(testSuite.targetId);
    } else {
      target = await Endpoint.findById(testSuite.targetId);
    }

    if (!target) {
      return NextResponse.json(
        { error: `Target ${testSuite.targetType} not found` },
        { status: 404 }
      );
    }

    // Create test run
    const testRun: ITestRun = {
      _id: new mongoose.Types.ObjectId(),
      runAt: new Date(),
      runBy: new mongoose.Types.ObjectId(auth.context.user.id),
      status: "running",
      results: [],
      summary: {
        total: testSuite.testCases.length,
        passed: 0,
        failed: 0,
        avgResponseTime: 0,
      },
    };

    // Execute all test cases
    let totalResponseTime = 0;
    let totalJudgeScore = 0;
    let judgeScoreCount = 0;

    for (const testCase of testSuite.testCases) {
      const result = await executeTestCase({
        testCase,
        targetType: testSuite.targetType,
        target,
        targetVersion: testSuite.targetVersion,
        validationRules: testSuite.validationRules,
        judgeConfig: testSuite.llmJudgeConfig,
        credentials,
      });

      const testResult = toTestResult(result);
      testRun.results.push(testResult);

      // Update stats
      if (result.validationPassed && !result.error) {
        testRun.summary.passed++;
      } else {
        testRun.summary.failed++;
      }

      totalResponseTime += result.responseTime;

      if (typeof result.judgeScore === "number") {
        totalJudgeScore += result.judgeScore;
        judgeScoreCount++;
      }
    }

    // Calculate averages
    testRun.summary.avgResponseTime = Math.round(
      totalResponseTime / testSuite.testCases.length
    );

    if (judgeScoreCount > 0) {
      testRun.summary.avgScore =
        Math.round((totalJudgeScore / judgeScoreCount) * 100) / 100;
    }

    testRun.status = "completed";

    // Update test suite with run results
    testSuite.lastRun = testRun;

    // Add to run history (keep last 10 runs)
    testSuite.runHistory.unshift(testRun);
    if (testSuite.runHistory.length > 10) {
      testSuite.runHistory = testSuite.runHistory.slice(0, 10);
    }

    await testSuite.save();

    // Get previous run for regression detection
    const previousRun = testSuite.runHistory[1]; // Index 1 because current run is at 0

    // Dispatch webhooks (async, don't block response)
    dispatchWebhooks(
      projectId,
      { id: projectId, name: project.name },
      {
        id: testRun._id.toString(),
        suiteId: suiteId,
        suiteName: testSuite.name,
        status: testRun.status,
        summary: testRun.summary,
        previousRun: previousRun
          ? {
              passed: previousRun.summary.passed,
              failed: previousRun.summary.failed,
            }
          : undefined,
      }
    ).catch((error) => {
      console.error("Error dispatching webhooks:", error);
    });

    return NextResponse.json({
      success: true,
      testRun,
    });
  } catch (error) {
    console.error("Error running test suite:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run test suite",
      },
      { status: 500 }
    );
  }
}
