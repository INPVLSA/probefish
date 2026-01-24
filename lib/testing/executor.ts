import { IPrompt, IPromptVersion } from "@/lib/db/models/prompt";
import { IEndpoint, IEndpointConfig } from "@/lib/db/models/endpoint";
import {
  ITestCase,
  ITestResult,
  IValidationRule,
  ILLMJudgeConfig,
  IJudgeCriterion,
  IJudgeValidationRule,
} from "@/lib/db/models/testSuite";
import { llmService, LLMProviderCredentials, LLMProvider } from "@/lib/llm";
import { validate, ValidationResult } from "./validator";
import {
  executeConversationPrompt,
  executeConversationEndpoint,
  ConversationExecutionResult,
} from "./conversationExecutor";
import mongoose from "mongoose";

// Execution result for a single test case
export interface TestCaseExecutionResult {
  testCaseId: mongoose.Types.ObjectId;
  testCaseName: string;
  inputs: Record<string, string>;
  output: string;
  extractedContent?: string;
  validationPassed: boolean;
  validationErrors: string[];
  judgeScore?: number;
  judgeScores?: Record<string, number>;
  judgeReasoning?: string;
  judgeValidationPassed?: boolean;
  judgeValidationResults?: Record<string, boolean>;
  judgeValidationErrors?: string[];
  judgeValidationWarnings?: string[];
  responseTime: number;
  error?: string;
}

// Helper to escape a string for use inside a JSON string value
function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// Helper to replace variables in a template
export function replaceVariables(
  template: string,
  variables: Record<string, string>,
  escapeForJson: boolean = false
): string {
  if (!template || typeof template !== "string") {
    return template ?? "";
  }
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const stringValue = typeof value === "string" ? value : String(value ?? "");
    const replacementValue = escapeForJson ? escapeJsonString(stringValue) : stringValue;
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    // Use function replacement to avoid special $ characters in replacement string
    result = result.replace(regex, () => replacementValue);
  }
  return result;
}

// Helper to get value from a nested path like "data.response.content"
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    // Handle array notation like "choices[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// Model override for multi-model comparison
export interface ModelOverride {
  provider: LLMProvider;
  model: string;
}

// Execute a prompt with LLM
export async function executePrompt(
  prompt: IPrompt,
  version: IPromptVersion,
  inputs: Record<string, string>,
  credentials: LLMProviderCredentials,
  modelOverride?: ModelOverride
): Promise<{ output: string; responseTime: number }> {
  const startTime = Date.now();

  // Substitute variables in the prompt content
  const content = replaceVariables(version.content, inputs);
  const systemPrompt = version.systemPrompt
    ? replaceVariables(version.systemPrompt, inputs)
    : undefined;

  // Use override if provided, otherwise use version config
  const provider = (modelOverride?.provider || version.modelConfig.provider || "openai") as LLMProvider;
  const model = modelOverride?.model || version.modelConfig.model || "gpt-4o-mini";

  const response = await llmService.simpleComplete(
    {
      provider,
      model,
      systemPrompt,
      userMessage: content,
      temperature: version.modelConfig.temperature,
      maxTokens: version.modelConfig.maxTokens,
    },
    credentials
  );

  return {
    output: response.content,
    responseTime: Date.now() - startTime,
  };
}

// Execute an endpoint HTTP request
export async function executeEndpoint(
  endpoint: IEndpoint,
  inputs: Record<string, string>
): Promise<{ output: string; extractedContent?: string; responseTime: number }> {
  const startTime = Date.now();
  const config: IEndpointConfig = endpoint.config;

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": config.contentType || "application/json",
  };

  // Add custom headers
  if (config.headers) {
    const headersObj =
      config.headers instanceof Map
        ? Object.fromEntries(config.headers)
        : config.headers;
    Object.assign(headers, headersObj);
  }

  // Add authentication
  if (config.auth) {
    switch (config.auth.type) {
      case "bearer":
        if (config.auth.token) {
          headers["Authorization"] = `Bearer ${config.auth.token}`;
        }
        break;
      case "apiKey":
        if (config.auth.apiKeyHeader && config.auth.apiKey) {
          headers[config.auth.apiKeyHeader] = config.auth.apiKey;
        }
        break;
      case "basic":
        if (config.auth.username && config.auth.password) {
          const credentials = Buffer.from(
            `${config.auth.username}:${config.auth.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;
    }
  }

  // Build request body
  let requestBody: string | undefined;
  if (["POST", "PUT", "PATCH"].includes(config.method) && config.bodyTemplate) {
    // Escape variables for JSON if content type is JSON
    const isJsonContent = headers["Content-Type"]?.includes("application/json");
    // Convert Mongoose Map to plain object if needed
    const plainInputs: Record<string, string> = inputs instanceof Map
      ? Object.fromEntries(inputs)
      : { ...inputs };
    // Filter out Mongoose internal fields
    const cleanInputs = Object.fromEntries(
      Object.entries(plainInputs).filter(([key]) => !key.startsWith('$__'))
    );
    requestBody = replaceVariables(config.bodyTemplate, cleanInputs, isJsonContent);
  }

  const response = await fetch(config.url, {
    method: config.method,
    headers,
    body: requestBody,
  });

  const responseTime = Date.now() - startTime;

  // Check for HTTP errors
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${errorBody}`
    );
  }

  // Parse response
  const contentType = response.headers.get("content-type") || "";
  let responseBody: unknown;
  let responseText: string;

  if (contentType.includes("application/json")) {
    responseText = await response.text();
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  } else {
    responseText = await response.text();
    responseBody = responseText;
  }

  // Extract content using responseContentPath if specified
  let extractedContent: unknown = responseBody;
  if (config.responseContentPath && typeof responseBody === "object") {
    extractedContent = getValueByPath(responseBody, config.responseContentPath);
  }

  // Convert to string for validation/judging
  const outputString =
    typeof extractedContent === "string"
      ? extractedContent
      : JSON.stringify(extractedContent, null, 2);

  return {
    output: outputString,
    extractedContent:
      extractedContent !== responseBody
        ? typeof extractedContent === "string"
          ? extractedContent
          : JSON.stringify(extractedContent, null, 2)
        : undefined,
    responseTime,
  };
}

// LLM Judge prompt template
const JUDGE_PROMPT = `You are an AI quality evaluator. Your task is to evaluate an AI response based on specific criteria.

**Input given to the AI:**
{{input}}

**Expected behavior/output:**
{{expected}}

**Actual response:**
{{output}}

**Evaluation criteria:**
{{criteria}}

For each criterion, provide a score from 0 to 10 and brief reasoning.
You MUST respond with ONLY valid JSON in exactly this format (no other text):
{
  "scores": {
    "criterion_name": { "score": 8, "reason": "Brief explanation" }
  },
  "overall_reasoning": "Summary of the evaluation"
}`;

// Judge an output using LLM
export async function judgeOutput(
  input: string,
  expectedOutput: string | undefined,
  actualOutput: string,
  judgeConfig: ILLMJudgeConfig,
  credentials: LLMProviderCredentials
): Promise<{
  score: number;
  scores: Record<string, number>;
  reasoning: string;
}> {
  if (!judgeConfig.enabled || judgeConfig.criteria.length === 0) {
    return { score: 0, scores: {}, reasoning: "" };
  }

  // Format criteria for the prompt
  const criteriaText = judgeConfig.criteria
    .map(
      (c: IJudgeCriterion, i: number) =>
        `${i + 1}. ${c.name} (weight: ${c.weight}): ${c.description}`
    )
    .join("\n");

  // Build the judge prompt
  let prompt = JUDGE_PROMPT;
  prompt = prompt.replace("{{input}}", input);
  prompt = prompt.replace("{{expected}}", expectedOutput || "Not specified");
  prompt = prompt.replace("{{output}}", actualOutput);
  prompt = prompt.replace("{{criteria}}", criteriaText);

  const provider = (judgeConfig.provider || "openai") as LLMProvider;
  const model = judgeConfig.model || "gpt-4o-mini";

  const response = await llmService.simpleComplete(
    {
      provider,
      model,
      userMessage: prompt,
      temperature: 0.3, // Lower temperature for more consistent judging
      maxTokens: 1024,
    },
    credentials
  );

  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in judge response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract scores per criterion
    const scores: Record<string, number> = {};
    for (const criterion of judgeConfig.criteria) {
      const criterionScore = parsed.scores?.[criterion.name]?.score;
      if (typeof criterionScore === "number") {
        scores[criterion.name] = criterionScore;
      }
    }

    // Calculate weighted score (normalized to 0-1)
    let weightedScore = 0;
    let totalWeight = 0;
    for (const criterion of judgeConfig.criteria) {
      const score = scores[criterion.name];
      if (typeof score === "number") {
        weightedScore += (score / 10) * criterion.weight;
        totalWeight += criterion.weight;
      }
    }

    // Normalize if weights don't sum to 1
    if (totalWeight > 0 && totalWeight !== 1) {
      weightedScore = weightedScore / totalWeight;
    }

    return {
      score: Math.round(weightedScore * 100) / 100, // Round to 2 decimal places
      scores,
      reasoning: parsed.overall_reasoning || "",
    };
  } catch (error) {
    console.error("Failed to parse judge response:", error);
    return {
      score: 0,
      scores: {},
      reasoning: `Failed to parse judge response: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// LLM Judge validation prompt template
const JUDGE_VALIDATION_PROMPT = `You are an AI compliance validator. Your task is to check if an AI response satisfies specific requirements.

**Input given to the AI:**
{{input}}

**Actual response:**
{{output}}

**Validation rules to check:**
{{rules}}

For each rule, determine if the response PASSES or FAILS the requirement.
You MUST respond with ONLY valid JSON in exactly this format (no other text):
{
  "results": {
    "rule_name": { "passed": true, "reason": "Brief explanation" }
  }
}`;

// Validate output using LLM judge validation rules
export async function validateWithJudge(
  input: string,
  actualOutput: string,
  validationRules: IJudgeValidationRule[],
  judgeConfig: ILLMJudgeConfig,
  credentials: LLMProviderCredentials
): Promise<{
  passed: boolean;
  results: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}> {
  if (!validationRules || validationRules.length === 0) {
    return { passed: true, results: {}, errors: [], warnings: [] };
  }

  // Format rules for the prompt
  const rulesText = validationRules
    .map(
      (r: IJudgeValidationRule, i: number) =>
        `${i + 1}. ${r.name}: ${r.description}`
    )
    .join("\n");

  // Build the validation prompt
  let prompt = JUDGE_VALIDATION_PROMPT;
  prompt = prompt.replace("{{input}}", input);
  prompt = prompt.replace("{{output}}", actualOutput);
  prompt = prompt.replace("{{rules}}", rulesText);

  const provider = (judgeConfig.provider || "openai") as LLMProvider;
  const model = judgeConfig.model || "gpt-4o-mini";

  const response = await llmService.simpleComplete(
    {
      provider,
      model,
      userMessage: prompt,
      temperature: 0.1, // Very low temperature for consistent validation
      maxTokens: 1024,
    },
    credentials
  );

  // Parse the JSON response
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in validation response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract pass/fail per rule
    const results: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];
    let allFailRulesPassed = true;

    for (const rule of validationRules) {
      const ruleResult = parsed.results?.[rule.name];
      const passed = ruleResult?.passed === true;
      results[rule.name] = passed;

      if (!passed) {
        const errorMsg = rule.failureMessage || `Failed: ${rule.name}`;
        const reason = ruleResult?.reason ? ` (${ruleResult.reason})` : "";
        const message = errorMsg + reason;

        // Check severity - default to "fail" if not specified
        const severity = rule.severity || "fail";
        if (severity === "warning") {
          warnings.push(message);
        } else {
          errors.push(message);
          allFailRulesPassed = false;
        }
      }
    }

    return {
      passed: allFailRulesPassed,
      results,
      errors,
      warnings,
    };
  } catch (error) {
    console.error("Failed to parse judge validation response:", error);
    return {
      passed: false,
      results: {},
      errors: [
        `Failed to validate: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
      warnings: [],
    };
  }
}

// Execute a single test case
export async function executeTestCase(params: {
  testCase: ITestCase;
  targetType: "prompt" | "endpoint";
  target: IPrompt | IEndpoint;
  targetVersion?: number;
  validationRules: IValidationRule[];
  judgeConfig: ILLMJudgeConfig;
  credentials: LLMProviderCredentials;
  modelOverride?: ModelOverride;
}): Promise<TestCaseExecutionResult> {
  const {
    testCase,
    targetType,
    target,
    targetVersion,
    validationRules,
    judgeConfig,
    credentials,
    modelOverride,
  } = params;

  // Check if this is a conversation test and delegate to conversation executor
  if (testCase.isConversation && testCase.conversation && testCase.conversation.length > 0) {
    if (targetType === "prompt") {
      const prompt = target as IPrompt;
      const version =
        prompt.versions.find((v) => v.version === (targetVersion || prompt.currentVersion)) ||
        prompt.versions[prompt.versions.length - 1];

      if (!version) {
        return {
          testCaseId: testCase._id,
          testCaseName: testCase.name,
          inputs: testCase.inputs,
          output: "",
          validationPassed: false,
          validationErrors: ["No prompt version found"],
          responseTime: 0,
          error: "No prompt version found",
        };
      }

      return executeConversationPrompt({
        testCase,
        prompt,
        version,
        credentials,
        validationRules,
        judgeConfig,
        modelOverride,
      });
    } else {
      const endpoint = target as IEndpoint;
      return executeConversationEndpoint({
        testCase,
        endpoint,
        validationRules,
        judgeConfig,
        credentials,
      });
    }
  }

  // Single-turn execution (existing behavior)
  const result: TestCaseExecutionResult = {
    testCaseId: testCase._id,
    testCaseName: testCase.name,
    inputs: testCase.inputs,
    output: "",
    validationPassed: false,
    validationErrors: [],
    responseTime: 0,
  };

  try {
    // Execute the target
    if (targetType === "prompt") {
      const prompt = target as IPrompt;
      const version =
        prompt.versions.find((v) => v.version === (targetVersion || prompt.currentVersion)) ||
        prompt.versions[prompt.versions.length - 1];

      if (!version) {
        throw new Error("No prompt version found");
      }

      const execution = await executePrompt(
        prompt,
        version,
        testCase.inputs,
        credentials,
        modelOverride
      );
      result.output = execution.output;
      result.responseTime = execution.responseTime;
    } else {
      const endpoint = target as IEndpoint;
      const execution = await executeEndpoint(endpoint, testCase.inputs);
      result.output = execution.output;
      result.extractedContent = execution.extractedContent;
      result.responseTime = execution.responseTime;
    }

    // Merge suite-level and per-case validation rules (per-case rules are ADDITIVE)
    const effectiveValidationRules = [
      ...validationRules,                    // Suite-level rules
      ...(testCase.validationRules || []),   // Per-case rules
    ];

    // Run validation rules (pass responseTime for maxResponseTime check)
    const validation: ValidationResult = validate(result.output, effectiveValidationRules, result.responseTime);
    result.validationPassed = validation.passed;
    result.validationErrors = validation.errors;

    // Run LLM judge if enabled
    if (judgeConfig.enabled) {
      const inputSummary = Object.entries(testCase.inputs)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      // Run scoring criteria
      if (judgeConfig.criteria.length > 0) {
        const judgeResult = await judgeOutput(
          inputSummary,
          testCase.expectedOutput,
          result.output,
          judgeConfig,
          credentials
        );

        result.judgeScore = judgeResult.score;
        result.judgeScores = judgeResult.scores;
        result.judgeReasoning = judgeResult.reasoning;

        // Check minimum score threshold (default to 70% if not set)
        const effectiveMinScore = judgeConfig.minScore ?? 0.7;
        if (effectiveMinScore > 0) {
          if (judgeResult.score < effectiveMinScore) {
            result.validationPassed = false;
            const minScorePercent = (effectiveMinScore * 100).toFixed(0);
            const actualScorePercent = (judgeResult.score * 100).toFixed(0);
            result.validationErrors.push(
              `Judge score ${actualScorePercent}% is below minimum threshold of ${minScorePercent}%`
            );
          }
        }
      }

      // Merge suite-level and per-case judge validation rules (ADDITIVE)
      const effectiveJudgeValidationRules = [
        ...(judgeConfig.validationRules || []),
        ...(testCase.judgeValidationRules || []),
      ];

      // Run validation rules (pass/fail gates and warnings)
      if (effectiveJudgeValidationRules.length > 0) {
        const validationResult = await validateWithJudge(
          inputSummary,
          result.output,
          effectiveJudgeValidationRules,
          judgeConfig,
          credentials
        );

        result.judgeValidationPassed = validationResult.passed;
        result.judgeValidationResults = validationResult.results;
        result.judgeValidationErrors = validationResult.errors;
        result.judgeValidationWarnings = validationResult.warnings;

        // If judge validation fails (only severity: fail rules), mark the overall validation as failed
        if (!validationResult.passed) {
          result.validationPassed = false;
          result.validationErrors = [
            ...result.validationErrors,
            ...validationResult.errors,
          ];
        }
      }
    }
  } catch (error) {
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Include cause for network errors (e.g., "fetch failed" -> "fetch failed (ENOTFOUND)")
      if (error.cause) {
        const causeMessage = error.cause instanceof Error
          ? error.cause.message
          : String(error.cause);
        errorMessage += ` (${causeMessage})`;
      }
    }
    result.error = errorMessage;
    result.validationPassed = false;
    result.validationErrors = [result.error];
  }

  return result;
}

// Convert execution result to ITestResult format
export function toTestResult(result: TestCaseExecutionResult): ITestResult {
  const testResult: ITestResult = {
    testCaseId: result.testCaseId,
    testCaseName: result.testCaseName,
    inputs: result.inputs,
    output: result.output,
    extractedContent: result.extractedContent,
    validationPassed: result.validationPassed,
    validationErrors: result.validationErrors,
    judgeScore: result.judgeScore,
    judgeScores: result.judgeScores,
    judgeReasoning: result.judgeReasoning,
    judgeValidationPassed: result.judgeValidationPassed,
    judgeValidationResults: result.judgeValidationResults,
    judgeValidationErrors: result.judgeValidationErrors,
    judgeValidationWarnings: result.judgeValidationWarnings,
    responseTime: result.responseTime,
    error: result.error,
  };

  // Add conversation-specific fields if present
  const conversationResult = result as ConversationExecutionResult;
  if (conversationResult.isConversation) {
    testResult.isConversation = true;
    testResult.turnResults = conversationResult.turnResults;
    testResult.totalTurns = conversationResult.totalTurns;
  }

  return testResult;
}
