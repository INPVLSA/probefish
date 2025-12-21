import { connectDB } from "@/lib/db/mongodb";
import Project from "@/lib/db/models/project";
import Prompt from "@/lib/db/models/prompt";
import Endpoint from "@/lib/db/models/endpoint";
import TestSuite from "@/lib/db/models/testSuite";
import Webhook from "@/lib/db/models/webhook";
import {
  validateProjectExport,
  formatZodErrors,
} from "../validators/schema";
import {
  ImportOptions,
  ImportPreview,
  ImportResult,
  ImportConflict,
  ImportError,
} from "../types";
import { ProjectExport } from "@/lib/export/types";

/**
 * Preview import without making changes
 */
export async function previewImport(
  projectId: string,
  data: unknown
): Promise<ImportPreview> {
  await connectDB();

  // Validate schema
  const validation = validateProjectExport(data);
  if (!validation.success) {
    return {
      valid: false,
      errors: formatZodErrors(validation.error),
      warnings: [],
      counts: {
        prompts: { new: 0, existing: 0, total: 0 },
        endpoints: { new: 0, existing: 0, total: 0 },
        testSuites: { new: 0, existing: 0, total: 0 },
        webhooks: { new: 0, existing: 0, total: 0 },
      },
      conflicts: [],
    };
  }

  const exportData = validation.data as ProjectExport;
  const conflicts: ImportConflict[] = [];
  const warnings: { path: string; message: string }[] = [];

  // Check project exists
  const project = await Project.findById(projectId);
  if (!project) {
    return {
      valid: false,
      errors: [{ path: "projectId", message: "Project not found", code: "not_found" }],
      warnings: [],
      counts: {
        prompts: { new: 0, existing: 0, total: 0 },
        endpoints: { new: 0, existing: 0, total: 0 },
        testSuites: { new: 0, existing: 0, total: 0 },
        webhooks: { new: 0, existing: 0, total: 0 },
      },
      conflicts: [],
    };
  }

  // Check for existing prompts by name
  const existingPrompts = await Prompt.find({ projectId }).lean();
  const promptNameMap = new Map(existingPrompts.map((p) => [p.name, p._id.toString()]));

  let newPrompts = 0;
  let existingPromptCount = 0;
  for (const prompt of exportData.prompts) {
    const existingId = promptNameMap.get(prompt.name);
    if (existingId) {
      existingPromptCount++;
      conflicts.push({
        type: "prompt",
        name: prompt.name,
        exportId: prompt._exportId,
        existingId,
      });
    } else {
      newPrompts++;
    }
  }

  // Check for existing endpoints by name
  const existingEndpoints = await Endpoint.find({ projectId }).lean();
  const endpointNameMap = new Map(existingEndpoints.map((e) => [e.name, e._id.toString()]));

  let newEndpoints = 0;
  let existingEndpointCount = 0;
  for (const endpoint of exportData.endpoints) {
    const existingId = endpointNameMap.get(endpoint.name);
    if (existingId) {
      existingEndpointCount++;
      conflicts.push({
        type: "endpoint",
        name: endpoint.name,
        exportId: endpoint._exportId,
        existingId,
      });
    } else {
      newEndpoints++;
    }
  }

  // Check for existing test suites by name
  const existingSuites = await TestSuite.find({ projectId }).lean();
  const suiteNameMap = new Map(existingSuites.map((s) => [s.name, s._id.toString()]));

  let newSuites = 0;
  let existingSuiteCount = 0;
  for (const suite of exportData.testSuites) {
    const existingId = suiteNameMap.get(suite.name);
    if (existingId) {
      existingSuiteCount++;
      conflicts.push({
        type: "testSuite",
        name: suite.name,
        exportId: suite._exportId,
        existingId,
      });
    } else {
      newSuites++;
    }

    // Validate target reference
    const targetExportId = suite.targetRef;
    const targetExists =
      (suite.targetType === "prompt" &&
        exportData.prompts.some((p) => p._exportId === targetExportId)) ||
      (suite.targetType === "endpoint" &&
        exportData.endpoints.some((e) => e._exportId === targetExportId));

    if (!targetExists) {
      warnings.push({
        path: `testSuites[${suite.name}].targetRef`,
        message: `Target ${suite.targetType} with exportId ${targetExportId} not found in import`,
      });
    }
  }

  // Check for existing webhooks by name
  const existingWebhooks = await Webhook.find({ projectId }).lean();
  const webhookNameMap = new Map(existingWebhooks.map((w) => [w.name, w._id.toString()]));

  let newWebhooks = 0;
  let existingWebhookCount = 0;
  for (const webhook of exportData.webhooks) {
    const existingId = webhookNameMap.get(webhook.name);
    if (existingId) {
      existingWebhookCount++;
      conflicts.push({
        type: "webhook",
        name: webhook.name,
        exportId: webhook.name, // webhooks don't have _exportId
        existingId,
      });
    } else {
      newWebhooks++;
    }
  }

  return {
    valid: true,
    errors: [],
    warnings,
    counts: {
      prompts: {
        new: newPrompts,
        existing: existingPromptCount,
        total: exportData.prompts.length,
      },
      endpoints: {
        new: newEndpoints,
        existing: existingEndpointCount,
        total: exportData.endpoints.length,
      },
      testSuites: {
        new: newSuites,
        existing: existingSuiteCount,
        total: exportData.testSuites.length,
      },
      webhooks: {
        new: newWebhooks,
        existing: existingWebhookCount,
        total: exportData.webhooks.length,
      },
    },
    conflicts,
  };
}

/**
 * Execute the import
 */
export async function executeImport(
  projectId: string,
  organizationId: string,
  userId: string,
  data: unknown,
  options: ImportOptions
): Promise<ImportResult> {
  await connectDB();

  // Validate schema
  const validation = validateProjectExport(data);
  if (!validation.success) {
    return {
      success: false,
      counts: {
        prompts: { created: 0, updated: 0, skipped: 0 },
        endpoints: { created: 0, updated: 0, skipped: 0 },
        testSuites: { created: 0, updated: 0, skipped: 0 },
        webhooks: { created: 0, updated: 0, skipped: 0 },
      },
      errors: formatZodErrors(validation.error),
      idMap: new Map(),
    };
  }

  const exportData = validation.data as ProjectExport;
  const idMap = new Map<string, string>(); // exportId -> mongoId
  const errors: ImportError[] = [];

  const counts = {
    prompts: { created: 0, updated: 0, skipped: 0 },
    endpoints: { created: 0, updated: 0, skipped: 0 },
    testSuites: { created: 0, updated: 0, skipped: 0 },
    webhooks: { created: 0, updated: 0, skipped: 0 },
  };

  // Get existing entities for conflict detection
  const existingPrompts = await Prompt.find({ projectId }).lean();
  const promptNameMap = new Map(existingPrompts.map((p) => [p.name, p]));

  const existingEndpoints = await Endpoint.find({ projectId }).lean();
  const endpointNameMap = new Map(existingEndpoints.map((e) => [e.name, e]));

  const existingSuites = await TestSuite.find({ projectId }).lean();
  const suiteNameMap = new Map(existingSuites.map((s) => [s.name, s]));

  const existingWebhooks = await Webhook.find({ projectId }).lean();
  const webhookNameMap = new Map(existingWebhooks.map((w) => [w.name, w]));

  // Import prompts first (for references)
  for (const promptData of exportData.prompts) {
    try {
      const existing = promptNameMap.get(promptData.name);

      if (existing) {
        if (options.mode === "merge" && options.skipExisting) {
          idMap.set(promptData._exportId, existing._id.toString());
          counts.prompts.skipped++;
          continue;
        }

        if (options.mode === "replace") {
          // Update existing prompt
          await Prompt.findByIdAndUpdate(existing._id, {
            description: promptData.description,
            versions: promptData.versions.map((v) => ({
              version: v.version,
              content: v.content,
              systemPrompt: v.systemPrompt,
              variables: v.variables,
              modelConfig: v.modelConfig,
              note: v.note,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            })),
            currentVersion: promptData.currentVersion,
            tags: promptData.tags,
          });
          idMap.set(promptData._exportId, existing._id.toString());
          counts.prompts.updated++;
          continue;
        }

        idMap.set(promptData._exportId, existing._id.toString());
        counts.prompts.skipped++;
      } else {
        // Create new prompt
        const newPrompt = await Prompt.create({
          projectId,
          organizationId,
          name: promptData.name,
          description: promptData.description,
          versions: promptData.versions.map((v) => ({
            version: v.version,
            content: v.content,
            systemPrompt: v.systemPrompt,
            variables: v.variables,
            modelConfig: v.modelConfig,
            note: v.note,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
          })),
          currentVersion: promptData.currentVersion,
          tags: promptData.tags,
          createdBy: userId,
        });
        idMap.set(promptData._exportId, newPrompt._id.toString());
        counts.prompts.created++;
      }
    } catch (error) {
      errors.push({
        path: `prompts[${promptData.name}]`,
        message: error instanceof Error ? error.message : "Failed to import prompt",
        code: "import_error",
      });
    }
  }

  // Import endpoints
  for (const endpointData of exportData.endpoints) {
    try {
      const existing = endpointNameMap.get(endpointData.name);

      if (existing) {
        if (options.mode === "merge" && options.skipExisting) {
          idMap.set(endpointData._exportId, existing._id.toString());
          counts.endpoints.skipped++;
          continue;
        }

        if (options.mode === "replace") {
          await Endpoint.findByIdAndUpdate(existing._id, {
            description: endpointData.description,
            config: endpointData.config,
            variables: endpointData.variables,
          });
          idMap.set(endpointData._exportId, existing._id.toString());
          counts.endpoints.updated++;
          continue;
        }

        idMap.set(endpointData._exportId, existing._id.toString());
        counts.endpoints.skipped++;
      } else {
        const newEndpoint = await Endpoint.create({
          projectId,
          organizationId,
          name: endpointData.name,
          description: endpointData.description,
          config: endpointData.config,
          variables: endpointData.variables,
          createdBy: userId,
        });
        idMap.set(endpointData._exportId, newEndpoint._id.toString());
        counts.endpoints.created++;
      }
    } catch (error) {
      errors.push({
        path: `endpoints[${endpointData.name}]`,
        message: error instanceof Error ? error.message : "Failed to import endpoint",
        code: "import_error",
      });
    }
  }

  // Import test suites (after prompts/endpoints for references)
  for (const suiteData of exportData.testSuites) {
    try {
      const existing = suiteNameMap.get(suiteData.name);

      // Resolve target reference
      const targetId = idMap.get(suiteData.targetRef);
      if (!targetId) {
        errors.push({
          path: `testSuites[${suiteData.name}].targetRef`,
          message: `Target ${suiteData.targetType} not found`,
          code: "reference_error",
        });
        continue;
      }

      if (existing) {
        if (options.mode === "merge" && options.skipExisting) {
          idMap.set(suiteData._exportId, existing._id.toString());
          counts.testSuites.skipped++;
          continue;
        }

        if (options.mode === "replace") {
          await TestSuite.findByIdAndUpdate(existing._id, {
            description: suiteData.description,
            targetType: suiteData.targetType,
            targetId,
            targetVersion: suiteData.targetVersion,
            testCases: suiteData.testCases,
            validationRules: suiteData.validationRules,
            llmJudgeConfig: suiteData.llmJudgeConfig,
            // Don't import run history - it's historical data
          });
          idMap.set(suiteData._exportId, existing._id.toString());
          counts.testSuites.updated++;
          continue;
        }

        idMap.set(suiteData._exportId, existing._id.toString());
        counts.testSuites.skipped++;
      } else {
        const newSuite = await TestSuite.create({
          projectId,
          organizationId,
          name: suiteData.name,
          description: suiteData.description,
          targetType: suiteData.targetType,
          targetId,
          targetVersion: suiteData.targetVersion,
          testCases: suiteData.testCases,
          validationRules: suiteData.validationRules,
          llmJudgeConfig: suiteData.llmJudgeConfig,
          createdBy: userId,
        });
        idMap.set(suiteData._exportId, newSuite._id.toString());
        counts.testSuites.created++;
      }
    } catch (error) {
      errors.push({
        path: `testSuites[${suiteData.name}]`,
        message: error instanceof Error ? error.message : "Failed to import test suite",
        code: "import_error",
      });
    }
  }

  // Import webhooks
  for (const webhookData of exportData.webhooks) {
    try {
      const existing = webhookNameMap.get(webhookData.name);

      // Resolve suite references
      const suiteIds = webhookData.suiteRefs
        ?.map((ref) => idMap.get(ref))
        .filter((id): id is string => !!id);

      if (existing) {
        if (options.mode === "merge" && options.skipExisting) {
          counts.webhooks.skipped++;
          continue;
        }

        if (options.mode === "replace") {
          await Webhook.findByIdAndUpdate(existing._id, {
            url: webhookData.url,
            events: webhookData.events,
            status: webhookData.status,
            suiteIds,
            onlyOnFailure: webhookData.onlyOnFailure,
            onlyOnRegression: webhookData.onlyOnRegression,
            retryCount: webhookData.retryCount,
            retryDelayMs: webhookData.retryDelayMs,
          });
          counts.webhooks.updated++;
          continue;
        }

        counts.webhooks.skipped++;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (Webhook as any).create({
          projectId,
          name: webhookData.name,
          url: webhookData.url,
          events: webhookData.events,
          status: webhookData.status,
          suiteIds,
          onlyOnFailure: webhookData.onlyOnFailure,
          onlyOnRegression: webhookData.onlyOnRegression,
          retryCount: webhookData.retryCount,
          retryDelayMs: webhookData.retryDelayMs,
          createdBy: userId,
        });
        counts.webhooks.created++;
      }
    } catch (error) {
      errors.push({
        path: `webhooks[${webhookData.name}]`,
        message: error instanceof Error ? error.message : "Failed to import webhook",
        code: "import_error",
      });
    }
  }

  return {
    success: errors.length === 0,
    counts,
    errors,
    idMap,
  };
}
