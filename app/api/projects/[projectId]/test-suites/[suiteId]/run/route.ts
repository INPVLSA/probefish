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
import TestSuite, { ITestRun, ITestCase } from "@/lib/db/models/testSuite";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import { executeTestCase, toTestResult } from "@/lib/testing";
import { executeTestSuiteWithStreaming } from "@/lib/testing/streamingExecutor";
import { executeTestsInParallel } from "@/lib/testing/parallelExecutor";
import {
  createSSEStream,
  sendSSEEvent,
  createSSEResponse,
  startHeartbeat,
  closeSSEStream,
} from "@/lib/testing/sseHelpers";
import { LLMProviderCredentials, LLMProvider } from "@/lib/llm";
import { decrypt } from "@/lib/utils/encryption";
import { dispatchWebhooks } from "@/lib/webhooks/dispatcher";
import { resolveTestSuiteByIdentifier } from "@/lib/utils/resolve-identifier";

interface RouteParams {
  params: Promise<{ projectId: string; suiteId: string }>;
}

// Provider configuration
const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini", "grok", "deepseek"];

const PROVIDER_CREDENTIAL_KEYS: Record<LLMProvider, keyof LLMProviderCredentials> = {
  openai: "openaiApiKey",
  anthropic: "anthropicApiKey",
  gemini: "geminiApiKey",
  grok: "grokApiKey",
  deepseek: "deepseekApiKey",
};

const PROVIDER_NAMES: Record<LLMProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  grok: "Grok",
  deepseek: "DeepSeek",
};

// Decrypt all provider credentials from organization
function decryptCredentials(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orgCredentials: any
): LLMProviderCredentials {
  const credentials: LLMProviderCredentials = {};
  if (!orgCredentials) return credentials;

  for (const provider of PROVIDERS) {
    const encryptedKey = orgCredentials[provider]?.apiKey;
    if (encryptedKey) {
      try {
        credentials[PROVIDER_CREDENTIAL_KEYS[provider]] = decrypt(encryptedKey);
      } catch (e) {
        console.error(`Failed to decrypt ${PROVIDER_NAMES[provider]} key:`, e);
      }
    }
  }
  return credentials;
}

// Check if credentials exist for a provider
function checkProviderCredentials(
  provider: string,
  credentials: LLMProviderCredentials,
  context?: string
): NextResponse | null {
  const credKey = PROVIDER_CREDENTIAL_KEYS[provider as LLMProvider];
  if (credKey && !credentials[credKey]) {
    const providerName = PROVIDER_NAMES[provider as LLMProvider] || provider;
    const suffix = context ? ` for ${context}` : "";
    return NextResponse.json(
      { error: `${providerName} API key is required${suffix}. Configure it in Settings > API Keys.` },
      { status: 400 }
    );
  }
  return null;
}

// POST /api/projects/[projectId]/test-suites/[suiteId]/run - Execute test suite
// Supports: Session auth OR Token auth with "test-runs:execute" scope
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdentifier, suiteId: suiteIdentifier } = await params;

  const auth = await requireProjectPermission(
    projectIdentifier,
    PROJECT_PERMISSIONS.VIEW,
    request,
    ["test-runs:execute"] // Required scope for token auth
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  // Use the resolved project ID from auth context
  const projectId = auth.context.project!.id;

  try {
    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Resolve test suite by ID or slug
    const testSuite = await resolveTestSuiteByIdentifier(suiteIdentifier, projectId);

    if (!testSuite) {
      return NextResponse.json(
        { error: "Test suite not found" },
        { status: 404 }
      );
    }

    const suiteId = testSuite._id.toString();

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
    const credentials = decryptCredentials(organization.llmCredentials);

    // Allow override from request body if provided
    const body = await request.json().catch(() => ({}));
    for (const provider of PROVIDERS) {
      const credKey = PROVIDER_CREDENTIAL_KEYS[provider];
      if (body[credKey]) {
        credentials[credKey] = body[credKey];
      }
    }

    // Model override for multi-model comparison
    const modelOverride = body.modelOverride as { provider: string; model: string } | undefined;

    // Optional note/title for the run
    const runNote = typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;

    // Number of iterations to run (default: 1, max: 100)
    const iterations = Math.min(Math.max(1, parseInt(body.iterations) || 1), 100);

    // Tags filter - if provided, only run test cases with matching tags (OR logic)
    const tagsFilter = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && t.trim()) : [];

    // Test case IDs filter - if provided, only run specific test cases (takes precedence over tags)
    const testCaseIds = Array.isArray(body.testCaseIds)
      ? body.testCaseIds.filter((id: unknown) => typeof id === "string" && id.trim())
      : [];

    // Filter test cases by IDs or tags
    let testCasesToRun = testSuite.testCases;
    if (testCaseIds.length > 0) {
      // Filter by specific test case IDs (takes precedence)
      testCasesToRun = testSuite.testCases.filter(
        (tc) => testCaseIds.includes(tc._id?.toString())
      );

      if (testCasesToRun.length === 0) {
        return NextResponse.json(
          { error: "No test cases match the selected IDs" },
          { status: 400 }
        );
      }
    } else if (tagsFilter.length > 0) {
      // Filter by tags
      testCasesToRun = testSuite.testCases.filter(
        (tc) => tc.tags?.some((tag) => tagsFilter.includes(tag))
      );

      if (testCasesToRun.length === 0) {
        return NextResponse.json(
          { error: "No test cases match the selected tags" },
          { status: 400 }
        );
      }
    }

    // Filter out disabled/paused test cases
    testCasesToRun = testCasesToRun.filter((tc) => tc.enabled !== false);

    if (testCasesToRun.length === 0) {
      return NextResponse.json(
        { error: "No enabled test cases to run" },
        { status: 400 }
      );
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

      // Use modelOverride provider if provided, otherwise use version's provider
      const provider = modelOverride?.provider || version?.modelConfig.provider || "openai";
      const credError = checkProviderCredentials(provider, credentials);
      if (credError) return credError;
    }

    // For LLM judge, check credentials
    if (testSuite.llmJudgeConfig.enabled) {
      const judgeProvider = testSuite.llmJudgeConfig.provider || "openai";
      const credError = checkProviderCredentials(judgeProvider, credentials, "LLM judge");
      if (credError) return credError;
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

    // Check for streaming mode
    const url = new URL(request.url);
    const streamMode = url.searchParams.get("stream") === "true";

    if (streamMode) {
      // STREAMING MODE: Return SSE stream with real-time results
      const maxConcurrency = organization.settings?.maxConcurrentTests || 5;
      return handleStreamingRun({
        request,
        projectId,
        testSuite,
        project,
        target,
        testCasesToRun,
        credentials,
        modelOverride,
        runNote,
        iterations,
        userId: auth.context.user.id,
        parallelExecution: testSuite.parallelExecution === true,
        maxConcurrency,
      });
    }

    // NON-STREAMING MODE: Original synchronous execution
    // Create test run
    const totalTestCount = testCasesToRun.length * iterations;
    const testRun: ITestRun = {
      _id: new mongoose.Types.ObjectId(),
      runAt: new Date(),
      runBy: new mongoose.Types.ObjectId(auth.context.user.id),
      status: "running",
      note: runNote,
      iterations: iterations > 1 ? iterations : undefined,
      modelOverride: modelOverride ? {
        provider: modelOverride.provider,
        model: modelOverride.model,
      } : undefined,
      results: [],
      summary: {
        total: totalTestCount,
        passed: 0,
        failed: 0,
        avgResponseTime: 0,
      },
    };

    // Execute all test cases for each iteration
    let totalResponseTime = 0;
    let totalJudgeScore = 0;
    let judgeScoreCount = 0;

    // Get concurrency limit from organization settings
    const maxConcurrency = organization.settings?.maxConcurrentTests || 5;
    const useParallel = testSuite.parallelExecution === true;

    for (let iteration = 1; iteration <= iterations; iteration++) {
      if (useParallel) {
        // Parallel execution
        const { results } = await executeTestsInParallel(
          testCasesToRun,
          (testCase) => executeTestCase({
            testCase,
            targetType: testSuite.targetType,
            target,
            targetVersion: testSuite.targetVersion,
            validationRules: testSuite.validationRules,
            judgeConfig: testSuite.llmJudgeConfig,
            credentials,
            modelOverride: modelOverride ? {
              provider: modelOverride.provider as "openai" | "anthropic" | "gemini",
              model: modelOverride.model,
            } : undefined,
          }),
          { maxConcurrency }
        );

        // Process parallel results
        for (const result of results) {
          const testResult = toTestResult(result);
          if (iterations > 1) {
            testResult.iteration = iteration;
          }
          testRun.results.push(testResult);

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
      } else {
        // Sequential execution (default)
        for (const testCase of testCasesToRun) {
          const result = await executeTestCase({
            testCase,
            targetType: testSuite.targetType,
            target,
            targetVersion: testSuite.targetVersion,
            validationRules: testSuite.validationRules,
            judgeConfig: testSuite.llmJudgeConfig,
            credentials,
            modelOverride: modelOverride ? {
              provider: modelOverride.provider as "openai" | "anthropic" | "gemini",
              model: modelOverride.model,
            } : undefined,
          });

          const testResult = toTestResult(result);
          // Add iteration number to result if running multiple iterations
          if (iterations > 1) {
            testResult.iteration = iteration;
          }
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
      }
    }

    // Calculate averages
    testRun.summary.avgResponseTime = Math.round(
      totalResponseTime / totalTestCount
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

    // Mark nested fields as modified so Mongoose persists changes
    testSuite.markModified("lastRun");
    testSuite.markModified("runHistory");

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

// Handle streaming test run with SSE
interface StreamingRunParams {
  request: NextRequest;
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  testSuite: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any;
  testCasesToRun: ITestCase[];
  credentials: LLMProviderCredentials;
  modelOverride?: { provider: string; model: string };
  runNote?: string;
  iterations: number;
  userId: string;
  parallelExecution: boolean;
  maxConcurrency: number;
}

async function handleStreamingRun({
  request,
  projectId,
  testSuite,
  project,
  target,
  testCasesToRun,
  credentials,
  modelOverride,
  runNote,
  iterations,
  userId,
  parallelExecution,
  maxConcurrency,
}: StreamingRunParams): Promise<Response> {
  const sse = createSSEStream();
  const stopHeartbeat = startHeartbeat(sse, 15000);

  const runId = new mongoose.Types.ObjectId();
  const totalTestCount = testCasesToRun.length * iterations;

  // Start async execution
  (async () => {
    try {
      // Send connected event
      await sendSSEEvent(sse, "connected", {
        runId: runId.toString(),
        total: totalTestCount,
        timestamp: new Date().toISOString(),
      });

      // Execute with streaming callbacks
      const { testRun, aborted } = await executeTestSuiteWithStreaming(
        {
          testCases: testCasesToRun,
          targetType: testSuite.targetType,
          target,
          targetVersion: testSuite.targetVersion,
          validationRules: testSuite.validationRules,
          judgeConfig: testSuite.llmJudgeConfig,
          credentials,
          modelOverride: modelOverride ? {
            provider: modelOverride.provider as "openai" | "anthropic" | "gemini",
            model: modelOverride.model,
          } : undefined,
          iterations,
          runId,
          runBy: new mongoose.Types.ObjectId(userId),
          note: runNote,
          parallelExecution,
          maxConcurrency,
        },
        {
          onProgress: async (progress) => {
            await sendSSEEvent(sse, "progress", progress);
          },
          onResult: async (result) => {
            await sendSSEEvent(sse, "result", result);
          },
          onError: async (error, testCaseId) => {
            await sendSSEEvent(sse, "error", {
              message: error.message,
              testCaseId,
            });
          },
        },
        request.signal
      );

      // Save to database
      testSuite.lastRun = testRun;
      testSuite.runHistory.unshift(testRun);
      if (testSuite.runHistory.length > 10) {
        testSuite.runHistory = testSuite.runHistory.slice(0, 10);
      }
      testSuite.markModified("lastRun");
      testSuite.markModified("runHistory");
      await testSuite.save();

      // Get previous run for regression detection
      const previousRun = testSuite.runHistory[1];

      // Dispatch webhooks (async, don't block)
      dispatchWebhooks(
        projectId,
        { id: projectId, name: project.name },
        {
          id: testRun._id.toString(),
          suiteId: testSuite._id.toString(),
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

      // Send complete event
      await sendSSEEvent(sse, "complete", {
        runId: runId.toString(),
        status: aborted ? "incomplete" : "completed",
        testRun,
      });
    } catch (error) {
      console.error("Streaming execution error:", error);
      try {
        await sendSSEEvent(sse, "error", {
          message: error instanceof Error ? error.message : "Execution failed",
          code: "EXECUTION_ERROR",
        });
      } catch {
        // Stream may be closed
      }
    } finally {
      stopHeartbeat();
      await closeSSEStream(sse);
    }
  })();

  return createSSEResponse(sse.stream.readable);
}
