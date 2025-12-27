import { connectDB } from "@/lib/db/mongodb";
import Project from "@/lib/db/models/project";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import TestSuite from "@/lib/db/models/testSuite";
import Webhook from "@/lib/db/models/webhook";
import {
  ProjectExport,
  ExportMetadata,
  PromptExport,
  EndpointExport,
  TestSuiteExport,
  WebhookExport,
  ExportOptions,
} from "../types";
import { nanoid } from "nanoid";

export async function collectProjectData(
  projectId: string,
  options: ExportOptions = {}
): Promise<ProjectExport> {
  await connectDB();

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // Create ID mapping for cross-references
  const idMap = new Map<string, string>();

  // Collect prompts
  const prompts = await Prompt.find({ projectId }).lean();
  const promptExports: PromptExport[] = prompts.map((prompt) => {
    const exportId = nanoid(10);
    idMap.set(prompt._id.toString(), exportId);
    return {
      _exportId: exportId,
      name: prompt.name,
      description: prompt.description,
      versions: (prompt.versions || []).map((v) => ({
        version: v.version,
        content: v.content,
        systemPrompt: v.systemPrompt,
        variables: v.variables || [],
        modelConfig: {
          provider: v.modelConfig?.provider,
          model: v.modelConfig?.model,
          temperature: v.modelConfig?.temperature,
          maxTokens: v.modelConfig?.maxTokens,
          topP: v.modelConfig?.topP,
          frequencyPenalty: v.modelConfig?.frequencyPenalty,
          presencePenalty: v.modelConfig?.presencePenalty,
        },
        note: v.note,
        createdAt: v.createdAt?.toISOString(),
      })),
      currentVersion: prompt.currentVersion,
      tags: prompt.tags || [],
    };
  });

  // Collect endpoints
  const endpoints = await Endpoint.find({ projectId }).lean();
  const endpointExports: EndpointExport[] = endpoints.map((endpoint) => {
    const exportId = nanoid(10);
    idMap.set(endpoint._id.toString(), exportId);
    return {
      _exportId: exportId,
      name: endpoint.name,
      description: endpoint.description,
      config: {
        method: endpoint.config.method,
        url: endpoint.config.url,
        headers: endpoint.config.headers,
        auth: endpoint.config.auth
          ? {
              type: endpoint.config.auth.type,
              // Exclude credentials for security
            }
          : undefined,
        bodyTemplate: endpoint.config.bodyTemplate,
        contentType: endpoint.config.contentType,
        responseContentPath: endpoint.config.responseContentPath,
      },
      variables: endpoint.variables || [],
    };
  });

  // Collect test suites
  const testSuites = await TestSuite.find({ projectId }).lean();
  const suiteExports: TestSuiteExport[] = testSuites.map((suite) => {
    const exportId = nanoid(10);
    idMap.set(suite._id.toString(), exportId);

    // Resolve target reference
    const targetRef =
      idMap.get(suite.targetId.toString()) || suite.targetId.toString();

    // Process run history if requested
    let runHistory;
    if (options.includeRunHistory && suite.runHistory) {
      const limit = options.runHistoryLimit || 10;
      runHistory = suite.runHistory.slice(0, limit).map((run) => ({
        runAt: run.runAt.toISOString(),
        status: run.status,
        results: (run.results || []).map((r) => ({
          testCaseName: r.testCaseName,
          inputs: r.inputs instanceof Map ? Object.fromEntries(r.inputs) : r.inputs || {},
          output: r.output || "",
          validationPassed: r.validationPassed,
          validationErrors: r.validationErrors || [],
          judgeScore: r.judgeScore,
          judgeScores:
            r.judgeScores instanceof Map
              ? Object.fromEntries(r.judgeScores)
              : r.judgeScores,
          judgeReasoning: r.judgeReasoning,
          responseTime: r.responseTime,
          error: r.error,
        })),
        summary: {
          total: run.summary.total,
          passed: run.summary.passed,
          failed: run.summary.failed,
          avgScore: run.summary.avgScore,
          avgResponseTime: run.summary.avgResponseTime,
        },
      }));
    }

    return {
      _exportId: exportId,
      name: suite.name,
      description: suite.description,
      targetType: suite.targetType,
      targetRef,
      targetVersion: suite.targetVersion,
      testCases: (suite.testCases || []).map((tc) => ({
        name: tc.name,
        inputs: tc.inputs instanceof Map ? Object.fromEntries(tc.inputs) : tc.inputs || {},
        expectedOutput: tc.expectedOutput,
        notes: tc.notes,
        tags: tc.tags || [],
      })),
      validationRules: (suite.validationRules || []).map((rule) => ({
        type: rule.type,
        value: rule.value,
        message: rule.message,
        severity: rule.severity || "fail",
      })),
      llmJudgeConfig: {
        enabled: suite.llmJudgeConfig?.enabled || false,
        provider: suite.llmJudgeConfig?.provider,
        model: suite.llmJudgeConfig?.model,
        criteria: (suite.llmJudgeConfig?.criteria || []).map((c) => ({
          name: c.name,
          description: c.description,
          weight: c.weight,
        })),
        validationRules: (suite.llmJudgeConfig?.validationRules || []).map(
          (r) => ({
            name: r.name,
            description: r.description,
            failureMessage: r.failureMessage,
            severity: r.severity,
          })
        ),
        minScore: suite.llmJudgeConfig?.minScore,
      },
      runHistory,
    };
  });

  // Collect webhooks
  const webhooks = await Webhook.find({ projectId }).lean();
  const webhookExports: WebhookExport[] = webhooks.map((webhook) => ({
    name: webhook.name,
    url: webhook.url,
    events: webhook.events,
    status: webhook.status === "failed" ? "inactive" : webhook.status,
    // Exclude secrets
    suiteRefs: webhook.suiteIds
      ?.map((id) => idMap.get(id.toString()))
      .filter((ref): ref is string => !!ref),
    onlyOnFailure: webhook.onlyOnFailure,
    onlyOnRegression: webhook.onlyOnRegression,
    retryCount: webhook.retryCount,
    retryDelayMs: webhook.retryDelayMs,
  }));

  const metadata: ExportMetadata = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    format: "json",
    source: "probefish",
    projectId,
    projectName: project.name,
    scope: "project",
  };

  return {
    metadata,
    project: {
      name: project.name,
      description: project.description,
      visibility: project.visibility,
    },
    prompts: promptExports,
    endpoints: endpointExports,
    testSuites: suiteExports,
    webhooks: webhookExports,
  };
}
