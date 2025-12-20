import mongoose, { Schema, Document, Model } from "mongoose";

// Test Case - a single test with variable inputs
export interface ITestCase {
  _id: mongoose.Types.ObjectId;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
}

// Validation Rule - static checks on output
export interface IValidationRule {
  type: "contains" | "excludes" | "minLength" | "maxLength" | "regex" | "jsonSchema" | "maxResponseTime";
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
  provider?: "openai" | "anthropic" | "gemini";
  model?: string;
  criteria: IJudgeCriterion[];
  validationRules?: IJudgeValidationRule[]; // Pass/fail gates
  minScore?: number; // Minimum score threshold (0-1) - test fails if score is below this
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
}

// Test Run - a complete execution of all test cases
export interface ITestRun {
  _id: mongoose.Types.ObjectId;
  runAt: Date;
  runBy: mongoose.Types.ObjectId;
  status: "running" | "completed" | "failed";
  results: ITestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore?: number;
    avgResponseTime: number;
  };
}

// Test Suite - the main document
export interface ITestSuite extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  targetType: "prompt" | "endpoint";
  targetId: mongoose.Types.ObjectId;
  targetVersion?: number;

  testCases: ITestCase[];
  validationRules: IValidationRule[];
  llmJudgeConfig: ILLMJudgeConfig;

  lastRun?: ITestRun;
  runHistory: ITestRun[];

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type TestSuiteModel = Model<ITestSuite>;

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
  },
  { _id: true }
);

const validationRuleSchema = new Schema<IValidationRule>(
  {
    type: {
      type: String,
      enum: ["contains", "excludes", "minLength", "maxLength", "regex", "jsonSchema", "maxResponseTime"],
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

const llmJudgeConfigSchema = new Schema<ILLMJudgeConfig>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ["openai", "anthropic", "gemini"],
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
    lastRun: testRunSchema,
    runHistory: {
      type: [testRunSchema],
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

const TestSuite: TestSuiteModel =
  mongoose.models.TestSuite ||
  mongoose.model<ITestSuite, TestSuiteModel>("TestSuite", testSuiteSchema);

export default TestSuite;
