import { connectDB } from "@/lib/db/mongodb";
import TestSuite from "@/lib/db/models/testSuite";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import {
  TestSuiteOnlyExport,
  ExportMetadata,
  TestSuiteExport,
  PromptExport,
  EndpointExport,
  ExportOptions,
} from "../types";
import { nanoid } from "nanoid";

export async function collectTestSuiteData(
  projectId: string,
  suiteId: string,
  options: ExportOptions = {}
): Promise<TestSuiteOnlyExport> {
  await connectDB();

  const suite = await TestSuite.findOne({ _id: suiteId, projectId }).lean();
  if (!suite) {
    throw new Error("Test suite not found");
  }

  const exportId = nanoid(10);

  // Get the target (prompt or endpoint)
  let targetData: PromptExport | EndpointExport;
  const targetExportId = nanoid(10);

  if (suite.targetType === "prompt") {
    const prompt = await Prompt.findById(suite.targetId).lean();
    if (!prompt) {
      throw new Error("Target prompt not found");
    }

    targetData = {
      _exportId: targetExportId,
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
  } else {
    const endpoint = await Endpoint.findById(suite.targetId).lean();
    if (!endpoint) {
      throw new Error("Target endpoint not found");
    }

    targetData = {
      _exportId: targetExportId,
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
  }

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

  const suiteExport: TestSuiteExport = {
    _exportId: exportId,
    name: suite.name,
    description: suite.description,
    targetType: suite.targetType,
    targetRef: targetExportId,
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

  // Get project name for metadata
  const Project = (await import("@/lib/db/models/project")).default;
  const project = await Project.findById(projectId).lean();

  const metadata: ExportMetadata = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    format: "json",
    source: "probefish",
    projectId,
    projectName: project?.name || "Unknown Project",
    scope: "test-suite",
    suiteId,
    suiteName: suite.name,
  };

  return {
    metadata,
    testSuite: suiteExport,
    target: {
      type: suite.targetType,
      data: targetData,
    },
  };
}
