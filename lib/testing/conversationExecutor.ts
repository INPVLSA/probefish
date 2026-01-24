import { IPrompt, IPromptVersion } from "@/lib/db/models/prompt";
import { IEndpoint, IEndpointConfig } from "@/lib/db/models/endpoint";
import {
  ITestCase,
  IValidationRule,
  ILLMJudgeConfig,
  ITurnResult,
} from "@/lib/db/models/testSuite";
import { llmService, LLMProviderCredentials, LLMProvider, LLMMessage } from "@/lib/llm";
import { validate, ValidationResult } from "./validator";
import { judgeOutput, validateWithJudge, replaceVariables, getValueByPath, ModelOverride, TestCaseExecutionResult } from "./executor";
import { EndpointSessionManager } from "./sessionManager";

// Extended execution result for conversation tests
export interface ConversationExecutionResult extends TestCaseExecutionResult {
  isConversation: true;
  turnResults: ITurnResult[];
  totalTurns: number;
}

/**
 * Execute a multi-turn conversation prompt test.
 * Maintains message history and calls LLM with full context for each user turn.
 */
export async function executeConversationPrompt(params: {
  testCase: ITestCase;
  prompt: IPrompt;
  version: IPromptVersion;
  credentials: LLMProviderCredentials;
  validationRules: IValidationRule[];
  judgeConfig: ILLMJudgeConfig;
  modelOverride?: ModelOverride;
}): Promise<ConversationExecutionResult> {
  const {
    testCase,
    version,
    credentials,
    validationRules,
    judgeConfig,
    modelOverride,
  } = params;

  const conversation = testCase.conversation || [];
  const validationTiming = testCase.validationTiming || "final-only";
  const isPerTurnValidation = validationTiming === "per-turn";

  const turnResults: ITurnResult[] = [];
  let totalResponseTime = 0;
  let lastOutput = "";
  let overallValidationPassed = true;
  const allValidationErrors: string[] = [];

  // Initialize message history with system prompt if present
  const messageHistory: LLMMessage[] = [];
  const systemPrompt = version.systemPrompt
    ? replaceVariables(version.systemPrompt, testCase.inputs)
    : undefined;

  if (systemPrompt) {
    messageHistory.push({ role: "system", content: systemPrompt });
  }

  // Determine provider and model
  const provider = (modelOverride?.provider || version.modelConfig.provider || "openai") as LLMProvider;
  const model = modelOverride?.model || version.modelConfig.model || "gpt-4o-mini";

  try {
    for (let i = 0; i < conversation.length; i++) {
      const turn = conversation[i];
      const startTime = Date.now();

      if (turn.role === "user") {
        // Merge variables: test case defaults < per-turn inputs
        const turnVariables: Record<string, string> = {
          ...testCase.inputs,       // Test case level defaults/context
          ...(turn.inputs || {}),   // Per-turn variable values (override defaults)
        };

        // Substitute variables in user content
        const userContent = replaceVariables(turn.content, turnVariables);

        // Add user message to history
        messageHistory.push({ role: "user", content: userContent });

        // Call LLM with full message history
        const response = await llmService.complete(
          {
            provider,
            model,
            messages: [...messageHistory],
            temperature: version.modelConfig.temperature,
            maxTokens: version.modelConfig.maxTokens,
          },
          credentials
        );

        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;

        const output = response.content;
        lastOutput = output;

        // Add assistant response to history for next turn
        messageHistory.push({ role: "assistant", content: output });

        // Create turn result
        const turnResult: ITurnResult = {
          turnIndex: i,
          role: "user",
          input: userContent,
          output,
          responseTime,
        };

        // Run per-turn validation if enabled
        if (isPerTurnValidation) {
          // Merge suite-level and turn-level validation rules
          const effectiveRules = [
            ...validationRules,
            ...(turn.validationRules || []),
          ];

          if (effectiveRules.length > 0) {
            const validation: ValidationResult = validate(output, effectiveRules, responseTime);
            turnResult.validationPassed = validation.passed;
            turnResult.validationErrors = validation.errors;

            if (!validation.passed) {
              overallValidationPassed = false;
              allValidationErrors.push(...validation.errors.map(e => `Turn ${i + 1}: ${e}`));
            }
          } else {
            turnResult.validationPassed = true;
            turnResult.validationErrors = [];
          }

          // Run per-turn judge validation if enabled and turn has judge rules
          if (judgeConfig.enabled && turn.judgeValidationRules && turn.judgeValidationRules.length > 0) {
            const inputSummary = userContent;
            const judgeResult = await validateWithJudge(
              inputSummary,
              output,
              turn.judgeValidationRules,
              judgeConfig,
              credentials
            );

            if (!judgeResult.passed) {
              turnResult.validationPassed = false;
              turnResult.validationErrors = [
                ...(turnResult.validationErrors || []),
                ...judgeResult.errors,
              ];
              overallValidationPassed = false;
              allValidationErrors.push(...judgeResult.errors.map(e => `Turn ${i + 1}: ${e}`));
            }
          }
        }

        turnResults.push(turnResult);

      } else if (turn.role === "assistant") {
        // Simulated assistant response - just add to history for context
        const simulatedContent = turn.simulatedResponse || turn.content;
        messageHistory.push({ role: "assistant", content: simulatedContent });

        // Record as a turn result (no LLM call)
        turnResults.push({
          turnIndex: i,
          role: "assistant",
          input: "(simulated)",
          output: simulatedContent,
          responseTime: 0,
        });
      }
    }

    // Run final validation (for final-only mode or as additional check)
    if (!isPerTurnValidation) {
      // Merge all validation rules
      const effectiveRules = [
        ...validationRules,
        ...(testCase.validationRules || []),
      ];

      if (effectiveRules.length > 0) {
        const validation: ValidationResult = validate(lastOutput, effectiveRules, totalResponseTime);
        overallValidationPassed = validation.passed;
        allValidationErrors.push(...validation.errors);
      }
    }

    // Build the result
    const result: ConversationExecutionResult = {
      testCaseId: testCase._id,
      testCaseName: testCase.name,
      inputs: testCase.inputs,
      output: lastOutput,
      validationPassed: overallValidationPassed,
      validationErrors: allValidationErrors,
      responseTime: totalResponseTime,
      isConversation: true,
      turnResults,
      totalTurns: conversation.length,
    };

    // Run LLM judge on final output if enabled
    if (judgeConfig.enabled && judgeConfig.criteria.length > 0) {
      const inputSummary = buildConversationSummary(testCase.inputs, turnResults);

      const judgeResult = await judgeOutput(
        inputSummary,
        testCase.expectedOutput,
        lastOutput,
        judgeConfig,
        credentials
      );

      result.judgeScore = judgeResult.score;
      result.judgeScores = judgeResult.scores;
      result.judgeReasoning = judgeResult.reasoning;

      // Check minimum score threshold
      const effectiveMinScore = judgeConfig.minScore ?? 0.7;
      if (effectiveMinScore > 0 && judgeResult.score < effectiveMinScore) {
        result.validationPassed = false;
        const minScorePercent = (effectiveMinScore * 100).toFixed(0);
        const actualScorePercent = (judgeResult.score * 100).toFixed(0);
        result.validationErrors.push(
          `Judge score ${actualScorePercent}% is below minimum threshold of ${minScorePercent}%`
        );
      }
    }

    // Run final judge validation rules if enabled
    const effectiveJudgeValidationRules = [
      ...(judgeConfig.validationRules || []),
      ...(testCase.judgeValidationRules || []),
    ];

    if (judgeConfig.enabled && effectiveJudgeValidationRules.length > 0) {
      const inputSummary = buildConversationSummary(testCase.inputs, turnResults);
      const validationResult = await validateWithJudge(
        inputSummary,
        lastOutput,
        effectiveJudgeValidationRules,
        judgeConfig,
        credentials
      );

      result.judgeValidationPassed = validationResult.passed;
      result.judgeValidationResults = validationResult.results;
      result.judgeValidationErrors = validationResult.errors;
      result.judgeValidationWarnings = validationResult.warnings;

      if (!validationResult.passed) {
        result.validationPassed = false;
        result.validationErrors.push(...validationResult.errors);
      }
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return {
      testCaseId: testCase._id,
      testCaseName: testCase.name,
      inputs: testCase.inputs,
      output: lastOutput || "",
      validationPassed: false,
      validationErrors: [errorMessage],
      responseTime: totalResponseTime,
      error: errorMessage,
      isConversation: true,
      turnResults,
      totalTurns: conversation.length,
    };
  }
}

/**
 * Execute a multi-turn conversation endpoint test.
 * Maintains session state (cookies, tokens) between requests.
 */
export async function executeConversationEndpoint(params: {
  testCase: ITestCase;
  endpoint: IEndpoint;
  validationRules: IValidationRule[];
  judgeConfig: ILLMJudgeConfig;
  credentials: LLMProviderCredentials;
}): Promise<ConversationExecutionResult> {
  const {
    testCase,
    endpoint,
    validationRules,
    judgeConfig,
    credentials,
  } = params;

  const conversation = testCase.conversation || [];
  const validationTiming = testCase.validationTiming || "final-only";
  const isPerTurnValidation = validationTiming === "per-turn";
  const config: IEndpointConfig = endpoint.config;

  const turnResults: ITurnResult[] = [];
  let totalResponseTime = 0;
  let lastOutput = "";
  let overallValidationPassed = true;
  const allValidationErrors: string[] = [];

  // Initialize session manager if session config is provided
  const sessionManager = testCase.sessionConfig?.enabled
    ? new EndpointSessionManager(testCase.sessionConfig)
    : null;

  try {
    for (let i = 0; i < conversation.length; i++) {
      const turn = conversation[i];
      const startTime = Date.now();

      if (turn.role === "user") {
        // Merge variables: test case defaults < per-turn inputs < session-extracted
        const allVariables: Record<string, string> = {
          ...testCase.inputs,           // Test case level defaults/context
          ...(turn.inputs || {}),       // Per-turn variable values (override defaults)
          ...(sessionManager?.getVariables() || {}),  // Session-extracted variables
        };

        // Substitute variables in user content (for endpoint body template)
        const userContent = replaceVariables(turn.content, allVariables);

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
                const basicCredentials = Buffer.from(
                  `${config.auth.username}:${config.auth.password}`
                ).toString("base64");
                headers["Authorization"] = `Basic ${basicCredentials}`;
              }
              break;
          }
        }

        // Build request body - use turn content as body template if it looks like JSON/template
        // Otherwise use the endpoint's bodyTemplate with turn content as a variable
        let requestBody: string | undefined;
        if (["POST", "PUT", "PATCH"].includes(config.method)) {
          const isJsonContent = headers["Content-Type"]?.includes("application/json");

          // Check if turn content is a body template
          const bodyTemplate = turn.content.trim().startsWith("{") || turn.content.includes("{{")
            ? turn.content
            : config.bodyTemplate;

          if (bodyTemplate) {
            const cleanInputs = Object.fromEntries(
              Object.entries(allVariables).filter(([key]) => !key.startsWith("$__"))
            );
            requestBody = replaceVariables(bodyTemplate, cleanInputs, isJsonContent);
          }
        }

        let url = config.url;

        // Apply session data (cookies, token injection)
        if (sessionManager) {
          const sessionData = sessionManager.applyToRequest(headers, requestBody || "", url);
          Object.assign(headers, sessionData.headers);
          requestBody = sessionData.body || requestBody;
          url = sessionData.url;
        }

        // Execute HTTP request
        const response = await fetch(url, {
          method: config.method,
          headers,
          body: requestBody,
        });

        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;

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

        // Process response for session management
        if (sessionManager) {
          sessionManager.processResponse(response, responseBody);
        }

        // Extract content using responseContentPath if specified
        let extractedContent: unknown = responseBody;
        if (config.responseContentPath && typeof responseBody === "object") {
          extractedContent = getValueByPath(responseBody, config.responseContentPath);
        }

        // Convert to string for validation/judging
        const output =
          typeof extractedContent === "string"
            ? extractedContent
            : JSON.stringify(extractedContent, null, 2);

        lastOutput = output;

        // Check for HTTP errors
        if (!response.ok) {
          const errorMessage = `HTTP ${response.status} ${response.statusText}: ${output}`;
          throw new Error(errorMessage);
        }

        // Create turn result
        const turnResult: ITurnResult = {
          turnIndex: i,
          role: "user",
          input: userContent,
          output,
          responseTime,
          extractedVariables: sessionManager?.getVariables(),
        };

        // Run per-turn validation if enabled
        if (isPerTurnValidation) {
          const effectiveRules = [
            ...validationRules,
            ...(turn.validationRules || []),
          ];

          if (effectiveRules.length > 0) {
            const validation: ValidationResult = validate(output, effectiveRules, responseTime);
            turnResult.validationPassed = validation.passed;
            turnResult.validationErrors = validation.errors;

            if (!validation.passed) {
              overallValidationPassed = false;
              allValidationErrors.push(...validation.errors.map(e => `Turn ${i + 1}: ${e}`));
            }
          } else {
            turnResult.validationPassed = true;
            turnResult.validationErrors = [];
          }
        }

        turnResults.push(turnResult);

      } else if (turn.role === "assistant") {
        // For endpoint tests, assistant turns are simulated responses for test documentation
        turnResults.push({
          turnIndex: i,
          role: "assistant",
          input: "(expected)",
          output: turn.simulatedResponse || turn.content,
          responseTime: 0,
        });
      }
    }

    // Run final validation (for final-only mode)
    if (!isPerTurnValidation) {
      const effectiveRules = [
        ...validationRules,
        ...(testCase.validationRules || []),
      ];

      if (effectiveRules.length > 0) {
        const validation: ValidationResult = validate(lastOutput, effectiveRules, totalResponseTime);
        overallValidationPassed = validation.passed;
        allValidationErrors.push(...validation.errors);
      }
    }

    // Build the result
    const result: ConversationExecutionResult = {
      testCaseId: testCase._id,
      testCaseName: testCase.name,
      inputs: testCase.inputs,
      output: lastOutput,
      validationPassed: overallValidationPassed,
      validationErrors: allValidationErrors,
      responseTime: totalResponseTime,
      isConversation: true,
      turnResults,
      totalTurns: conversation.length,
    };

    // Run LLM judge on final output if enabled
    if (judgeConfig.enabled && judgeConfig.criteria.length > 0) {
      const inputSummary = buildConversationSummary(testCase.inputs, turnResults);

      const judgeResult = await judgeOutput(
        inputSummary,
        testCase.expectedOutput,
        lastOutput,
        judgeConfig,
        credentials
      );

      result.judgeScore = judgeResult.score;
      result.judgeScores = judgeResult.scores;
      result.judgeReasoning = judgeResult.reasoning;

      // Check minimum score threshold
      const effectiveMinScore = judgeConfig.minScore ?? 0.7;
      if (effectiveMinScore > 0 && judgeResult.score < effectiveMinScore) {
        result.validationPassed = false;
        const minScorePercent = (effectiveMinScore * 100).toFixed(0);
        const actualScorePercent = (judgeResult.score * 100).toFixed(0);
        result.validationErrors.push(
          `Judge score ${actualScorePercent}% is below minimum threshold of ${minScorePercent}%`
        );
      }
    }

    // Run final judge validation rules if enabled
    const effectiveJudgeValidationRules = [
      ...(judgeConfig.validationRules || []),
      ...(testCase.judgeValidationRules || []),
    ];

    if (judgeConfig.enabled && effectiveJudgeValidationRules.length > 0) {
      const inputSummary = buildConversationSummary(testCase.inputs, turnResults);
      const validationResult = await validateWithJudge(
        inputSummary,
        lastOutput,
        effectiveJudgeValidationRules,
        judgeConfig,
        credentials
      );

      result.judgeValidationPassed = validationResult.passed;
      result.judgeValidationResults = validationResult.results;
      result.judgeValidationErrors = validationResult.errors;
      result.judgeValidationWarnings = validationResult.warnings;

      if (!validationResult.passed) {
        result.validationPassed = false;
        result.validationErrors.push(...validationResult.errors);
      }
    }

    return result;

  } catch (error) {
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.cause) {
        const causeMessage = error.cause instanceof Error
          ? error.cause.message
          : String(error.cause);
        errorMessage += ` (${causeMessage})`;
      }
    }

    return {
      testCaseId: testCase._id,
      testCaseName: testCase.name,
      inputs: testCase.inputs,
      output: lastOutput || "",
      validationPassed: false,
      validationErrors: [errorMessage],
      responseTime: totalResponseTime,
      error: errorMessage,
      isConversation: true,
      turnResults,
      totalTurns: conversation.length,
    };
  }
}

/**
 * Build a summary of the conversation for LLM judge.
 */
function buildConversationSummary(
  inputs: Record<string, string>,
  turnResults: ITurnResult[]
): string {
  const parts: string[] = [];

  // Add input variables
  if (Object.keys(inputs).length > 0) {
    parts.push("Variables:");
    for (const [key, value] of Object.entries(inputs)) {
      parts.push(`  ${key}: ${value}`);
    }
    parts.push("");
  }

  // Add conversation turns
  parts.push("Conversation:");
  for (const turn of turnResults) {
    if (turn.role === "user") {
      parts.push(`  User: ${turn.input}`);
      parts.push(`  Assistant: ${turn.output}`);
    }
  }

  return parts.join("\n");
}
