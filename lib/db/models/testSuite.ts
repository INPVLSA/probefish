import mongoose, { Schema, Document, Model } from "mongoose";
import { LLMProvider } from "@/lib/llm/types";

// Validation mode for test cases
export type TestCaseValidationMode = "text" | "rules";

// Validation timing mode for conversation tests
export type ValidationTimingMode = "per-turn" | "final-only";

// Conversation turn for multi-message testing
export interface IConversationTurn {
  role: "user" | "assistant";
  content: string; // Display label or template override

  // Per-turn variable values (substituted into endpoint bodyTemplate or prompt)
  inputs?: Record<string, string>;

  // Optional simulated response (for setting up context without LLM call)
  simulatedResponse?: string;

  // Per-turn validation (when validationTiming === "per-turn")
  expectedOutput?: string;
  validationRules?: IValidationRule[];
  judgeValidationRules?: IJudgeValidationRule[];
}

// Session configuration for endpoint multi-turn testing
export interface ISessionConfig {
  enabled: boolean;

  // Cookie-based session management
  persistCookies?: boolean;

  // Token extraction from response
  tokenExtraction?: {
    enabled: boolean;
    responsePath: string; // JSON path to extract token (e.g., "data.accessToken")
    injection: {
      type: "header" | "body" | "query";
      target: string; // Header name, body path, or query param name
      prefix?: string; // Optional prefix (e.g., "Bearer ")
    };
  };

  // Variable extraction from responses for subsequent turns
  variableExtraction?: {
    name: string; // Variable name to create
    responsePath: string; // JSON path to extract value
  }[];
}

// Result for a single conversation turn
export interface ITurnResult {
  turnIndex: number;
  role: "user" | "assistant";
  input: string; // The input sent (user content with variables substituted)
  output: string; // LLM/endpoint response

  // Per-turn validation (if validationTiming === "per-turn")
  validationPassed?: boolean;
  validationErrors?: string[];
  judgeScore?: number;
  judgeReasoning?: string;

  responseTime: number;
  error?: string;

  // Session data extracted (for endpoint tests)
  extractedVariables?: Record<string, string>;
}

// Test Case - a single test with variable inputs
export interface ITestCase {
  _id: mongoose.Types.ObjectId;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
  enabled?: boolean; // Whether the test case is active (default: true)
  // Per-case validation configuration
  validationMode?: TestCaseValidationMode; // "text" (legacy) or "rules" (new default)
  validationRules?: IValidationRule[]; // Only used when validationMode === "rules"
  judgeValidationRules?: IJudgeValidationRule[]; // Additive to suite-level judge rules

  // Multi-message conversation support
  isConversation?: boolean; // Flag to indicate multi-turn test
  conversation?: IConversationTurn[]; // Ordered list of conversation turns
  validationTiming?: ValidationTimingMode; // "per-turn" or "final-only" (default: "final-only")
  sessionConfig?: ISessionConfig; // Session management for endpoint tests
}

// Validation Rule - static checks on output
export interface IValidationRule {
  type: "contains" | "excludes" | "minLength" | "maxLength" | "regex" | "jsonSchema" | "maxResponseTime" | "isJson" | "containsJson";
  value: string | number;
  message?: string;
  severity?: "fail" | "warning";
}

// Judge Criterion - for LLM-as-judge evaluation (scoring)
export interface IJudgeCriterion {
  name: string;
  description: string;
  weight: number;
}

// Judge Validation Rule - for pass/fail gate or warning
export interface IJudgeValidationRule {
  name: string;
  description: string;
  failureMessage?: string; // Message to show when validation fails
  severity: "fail" | "warning"; // fail = test fails, warning = test passes but shows warning
}

// LLM Judge Configuration
export interface ILLMJudgeConfig {
  enabled: boolean;
  provider?: LLMProvider;
  model?: string;
  criteria: IJudgeCriterion[];
  validationRules?: IJudgeValidationRule[]; // Pass/fail gates
  minScore?: number; // Minimum score threshold (0-1) - test fails if score is below this
}

// Model selection for multi-model comparison
export interface IModelSelection {
  provider: LLMProvider;
  model: string;
  isPrimary?: boolean;
}

// Test Result - result of a single test case execution
export interface ITestResult {
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
  judgeValidationPassed?: boolean; // Did all judge validation rules with severity "fail" pass?
  judgeValidationResults?: Record<string, boolean>; // Pass/fail per rule
  judgeValidationErrors?: string[]; // Failure messages (severity: fail)
  judgeValidationWarnings?: string[]; // Warning messages (severity: warning)

  responseTime: number;
  error?: string;
  iteration?: number; // Iteration number when running multiple iterations

  // Conversation results
  isConversation?: boolean; // Whether this is a multi-turn test result
  turnResults?: ITurnResult[]; // Results for each conversation turn
  totalTurns?: number; // Total number of turns in the conversation
}

// Test Run - a complete execution of all test cases
export interface ITestRun {
  _id: mongoose.Types.ObjectId;
  runAt: Date;
  runBy: mongoose.Types.ObjectId;
  status: "running" | "completed" | "failed";
  note?: string; // Custom note/title for the run
  iterations?: number; // Number of iterations run (only set if > 1)
  modelOverride?: {
    provider: string;
    model: string;
  };
  results: ITestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

// Comparison Session - groups multiple model runs together
export interface IComparisonSession {
  _id: mongoose.Types.ObjectId;
  runAt: Date;
  runBy: mongoose.Types.ObjectId;
  models: IModelSelection[];
  runs: ITestRun[];
}

// Test Suite - the main document
export interface ITestSuite extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  targetType: "prompt" | "endpoint";
  targetId: mongoose.Types.ObjectId;
  targetVersion?: number;

  testCases: ITestCase[];
  validationRules: IValidationRule[];
  llmJudgeConfig: ILLMJudgeConfig;
  comparisonModels?: IModelSelection[]; // Saved models for multi-model comparison
  parallelExecution?: boolean; // Enable parallel test execution (default: false)

  lastRun?: ITestRun;
  runHistory: ITestRun[];
  comparisonSessions: IComparisonSession[];

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type TestSuiteModel = Model<ITestSuite>;

const validationRuleSchema = new Schema<IValidationRule>(
  {
    type: {
      type: String,
      enum: ["contains", "excludes", "minLength", "maxLength", "regex", "jsonSchema", "maxResponseTime", "isJson", "containsJson"],
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    message: String,
    severity: {
      type: String,
      enum: ["fail", "warning"],
      default: "fail",
    },
  },
  { _id: false }
);

const judgeCriterionSchema = new Schema<IJudgeCriterion>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
  },
  { _id: false }
);

const judgeValidationRuleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    failureMessage: String,
    severity: {
      type: String,
      enum: ["fail", "warning"],
      default: "fail",
    },
  },
  { _id: false }
);

// Schema for conversation turns
const conversationTurnSchema = new Schema<IConversationTurn>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      default: "",  // Not required - auto-generated for endpoints
    },
    inputs: {
      type: Map,
      of: String,
      default: undefined,
    },
    simulatedResponse: String,
    expectedOutput: String,
    validationRules: {
      type: [validationRuleSchema],
      default: [],
    },
    judgeValidationRules: {
      type: [judgeValidationRuleSchema],
      default: [],
    },
  },
  { _id: false }
);

// Schema for session configuration (endpoint multi-turn testing)
const sessionConfigSchema = new Schema<ISessionConfig>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    persistCookies: {
      type: Boolean,
      default: false,
    },
    tokenExtraction: {
      enabled: {
        type: Boolean,
        default: false,
      },
      responsePath: String,
      injection: {
        type: {
          type: String,
          enum: ["header", "body", "query"],
        },
        target: String,
        prefix: String,
      },
    },
    variableExtraction: [
      {
        name: String,
        responsePath: String,
      },
    ],
  },
  { _id: false }
);

// Schema for turn results
const turnResultSchema = new Schema<ITurnResult>(
  {
    turnIndex: {
      type: Number,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    input: {
      type: String,
      required: true,
    },
    output: {
      type: String,
      required: true,
    },
    validationPassed: Boolean,
    validationErrors: [String],
    judgeScore: Number,
    judgeReasoning: String,
    responseTime: {
      type: Number,
      required: true,
    },
    error: String,
    extractedVariables: {
      type: Map,
      of: String,
    },
  },
  { _id: false }
);

const testCaseSchema = new Schema<ITestCase>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    inputs: {
      type: Map,
      of: String,
      default: {},
    },
    expectedOutput: String,
    notes: String,
    tags: {
      type: [String],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Per-case validation configuration
    validationMode: {
      type: String,
      enum: ["text", "rules"],
      default: undefined,
    },
    validationRules: {
      type: [validationRuleSchema],
      default: [],
    },
    judgeValidationRules: {
      type: [judgeValidationRuleSchema],
      default: [],
    },
    // Multi-message conversation support
    isConversation: {
      type: Boolean,
      default: false,
    },
    conversation: {
      type: [conversationTurnSchema],
      default: [],
    },
    validationTiming: {
      type: String,
      enum: ["per-turn", "final-only"],
      default: "final-only",
    },
    sessionConfig: {
      type: sessionConfigSchema,
      default: undefined,
    },
  },
  { _id: true }
);

const llmJudgeConfigSchema = new Schema<ILLMJudgeConfig>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ["openai", "anthropic", "gemini", "grok", "deepseek"],
    },
    model: String,
    criteria: [judgeCriterionSchema],
    validationRules: [judgeValidationRuleSchema],
    minScore: {
      type: Number,
      min: 0,
      max: 1,
    },
  },
  { _id: false }
);

const testResultSchema = new Schema<ITestResult>(
  {
    testCaseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    testCaseName: {
      type: String,
      required: true,
    },
    inputs: {
      type: Map,
      of: String,
    },
    output: String,
    extractedContent: String,
    validationPassed: {
      type: Boolean,
      required: true,
    },
    validationErrors: [String],
    judgeScore: Number,
    judgeScores: {
      type: Map,
      of: Number,
    },
    judgeReasoning: String,
    judgeValidationPassed: Boolean,
    judgeValidationResults: {
      type: Map,
      of: Boolean,
    },
    judgeValidationErrors: [String],
    judgeValidationWarnings: [String],
    responseTime: {
      type: Number,
      required: true,
    },
    error: String,
    iteration: Number,
    // Conversation results
    isConversation: Boolean,
    turnResults: {
      type: [turnResultSchema],
      default: undefined,
    },
    totalTurns: Number,
  },
  { _id: false }
);

const testRunSchema = new Schema<ITestRun>(
  {
    runAt: {
      type: Date,
      default: Date.now,
    },
    runBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
    iterations: Number,
    modelOverride: {
      provider: String,
      model: String,
    },
    results: [testResultSchema],
    summary: {
      total: { type: Number, default: 0 },
      passed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      avgScore: Number,
      avgResponseTime: { type: Number, default: 0 },
    },
  },
  { _id: true }
);

const testSuiteSchema = new Schema<ITestSuite>(
  {
    name: {
      type: String,
      required: [true, "Test suite name is required"],
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      lowercase: true,
      trim: true,
      minlength: [3, "Slug must be at least 3 characters"],
      maxlength: [50, "Slug cannot exceed 50 characters"],
      match: [/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug must contain only lowercase letters, numbers, and hyphens, and must start and end with a letter or number"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["prompt", "endpoint"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
    },
    targetVersion: Number,
    testCases: [testCaseSchema],
    validationRules: [validationRuleSchema],
    llmJudgeConfig: {
      type: llmJudgeConfigSchema,
      default: { enabled: false, criteria: [], validationRules: [] },
    },
    comparisonModels: [
      {
        provider: {
          type: String,
          enum: ["openai", "anthropic", "gemini", "grok", "deepseek"],
          required: true,
        },
        model: {
          type: String,
          required: true,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],
    parallelExecution: {
      type: Boolean,
      default: false,
    },
    lastRun: testRunSchema,
    runHistory: {
      type: [testRunSchema],
      default: [],
    },
    comparisonSessions: {
      type: [
        {
          runAt: {
            type: Date,
            default: Date.now,
          },
          runBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          models: [
            {
              provider: {
                type: String,
                enum: ["openai", "anthropic", "gemini", "grok", "deepseek"],
                required: true,
              },
              model: {
                type: String,
                required: true,
              },
              isPrimary: {
                type: Boolean,
                default: false,
              },
            },
          ],
          runs: [testRunSchema],
        },
      ],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

testSuiteSchema.index({ projectId: 1 });
testSuiteSchema.index({ organizationId: 1 });
testSuiteSchema.index({ targetType: 1, targetId: 1 });
testSuiteSchema.index({ name: "text", description: "text" });
testSuiteSchema.index({ projectId: 1, slug: 1 }, { unique: true });

const TestSuite: TestSuiteModel =
  mongoose.models.TestSuite ||
  mongoose.model<ITestSuite, TestSuiteModel>("TestSuite", testSuiteSchema);

export default TestSuite;
