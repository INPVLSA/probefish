import { describe, it, expect } from "vitest";
import {
  validateProjectExport,
  formatZodErrors,
} from "@/lib/import/validators/schema";

describe("Import Validators", () => {
  const validProjectExport = {
    metadata: {
      version: "1.0" as const,
      exportedAt: "2024-01-01T00:00:00.000Z",
      format: "json" as const,
      source: "probefish" as const,
      projectId: "project-123",
      projectName: "Test Project",
      scope: "project" as const,
    },
    project: {
      name: "Test Project",
      description: "A test project",
      visibility: "private" as const,
    },
    prompts: [
      {
        _exportId: "prompt-exp-1",
        name: "Test Prompt",
        versions: [
          {
            version: 1,
            content: "Hello {{name}}",
            variables: ["name"],
            modelConfig: {
              provider: "openai" as const,
              model: "gpt-4",
              temperature: 0.7,
            },
          },
        ],
        currentVersion: 1,
        tags: ["test"],
      },
    ],
    endpoints: [],
    testSuites: [],
    webhooks: [],
  };

  describe("validateProjectExport", () => {
    it("should validate a correct project export", () => {
      const result = validateProjectExport(validProjectExport);

      expect(result.success).toBe(true);
    });

    it("should reject invalid metadata version", () => {
      const invalid = {
        ...validProjectExport,
        metadata: { ...validProjectExport.metadata, version: "2.0" },
      };

      const result = validateProjectExport(invalid);

      expect(result.success).toBe(false);
    });

    it("should reject invalid metadata source", () => {
      const invalid = {
        ...validProjectExport,
        metadata: { ...validProjectExport.metadata, source: "other" },
      };

      const result = validateProjectExport(invalid);

      expect(result.success).toBe(false);
    });

    it("should reject missing project name", () => {
      const invalid = {
        ...validProjectExport,
        project: { ...validProjectExport.project, name: "" },
      };

      const result = validateProjectExport(invalid);

      expect(result.success).toBe(false);
    });

    it("should reject invalid visibility", () => {
      const invalid = {
        ...validProjectExport,
        project: { ...validProjectExport.project, visibility: "hidden" },
      };

      const result = validateProjectExport(invalid);

      expect(result.success).toBe(false);
    });

    it("should validate prompts with required fields", () => {
      const withInvalidPrompt = {
        ...validProjectExport,
        prompts: [{ _exportId: "p1", name: "", versions: [], currentVersion: 1, tags: [] }],
      };

      const result = validateProjectExport(withInvalidPrompt);

      expect(result.success).toBe(false);
    });

    it("should validate endpoint URLs", () => {
      const withEndpoint = {
        ...validProjectExport,
        endpoints: [
          {
            _exportId: "e1",
            name: "Test Endpoint",
            config: {
              method: "POST" as const,
              url: "not-a-valid-url",
            },
            variables: [],
          },
        ],
      };

      const result = validateProjectExport(withEndpoint);

      expect(result.success).toBe(false);
    });

    it("should validate webhook events", () => {
      const withWebhook = {
        ...validProjectExport,
        webhooks: [
          {
            name: "Test Webhook",
            url: "https://example.com/webhook",
            events: ["invalid.event"],
            status: "active" as const,
            retryCount: 3,
            retryDelayMs: 1000,
          },
        ],
      };

      const result = validateProjectExport(withWebhook);

      expect(result.success).toBe(false);
    });

    it("should require at least one webhook event", () => {
      const withEmptyEvents = {
        ...validProjectExport,
        webhooks: [
          {
            name: "Test Webhook",
            url: "https://example.com/webhook",
            events: [],
            status: "active" as const,
            retryCount: 3,
            retryDelayMs: 1000,
          },
        ],
      };

      const result = validateProjectExport(withEmptyEvents);

      expect(result.success).toBe(false);
    });

    it("should validate test suite target type", () => {
      const withTestSuite = {
        ...validProjectExport,
        testSuites: [
          {
            _exportId: "ts1",
            name: "Test Suite",
            targetType: "invalid" as const,
            targetRef: "prompt-exp-1",
            testCases: [],
            validationRules: [],
            llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
          },
        ],
      };

      const result = validateProjectExport(withTestSuite);

      expect(result.success).toBe(false);
    });

    it("should validate test cases with tags", () => {
      const withTestCaseTags = {
        ...validProjectExport,
        testSuites: [
          {
            _exportId: "ts1",
            name: "Test Suite",
            targetType: "prompt" as const,
            targetRef: "prompt-exp-1",
            testCases: [
              {
                name: "Test with tags",
                inputs: { name: "World" },
                tags: ["smoke", "regression", "auth"],
              },
            ],
            validationRules: [],
            llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
          },
        ],
      };

      const result = validateProjectExport(withTestCaseTags);

      expect(result.success).toBe(true);
    });

    it("should accept test cases with empty tags array", () => {
      const withEmptyTags = {
        ...validProjectExport,
        testSuites: [
          {
            _exportId: "ts1",
            name: "Test Suite",
            targetType: "prompt" as const,
            targetRef: "prompt-exp-1",
            testCases: [
              {
                name: "Test without tags",
                inputs: { name: "World" },
                tags: [],
              },
            ],
            validationRules: [],
            llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
          },
        ],
      };

      const result = validateProjectExport(withEmptyTags);

      expect(result.success).toBe(true);
    });

    it("should accept test cases without tags field (defaults to empty)", () => {
      const withoutTags = {
        ...validProjectExport,
        testSuites: [
          {
            _exportId: "ts1",
            name: "Test Suite",
            targetType: "prompt" as const,
            targetRef: "prompt-exp-1",
            testCases: [
              {
                name: "Test without tags field",
                inputs: { name: "World" },
              },
            ],
            validationRules: [],
            llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
          },
        ],
      };

      const result = validateProjectExport(withoutTags);

      expect(result.success).toBe(true);
    });

    it("should validate validation rule types", () => {
      const withValidationRules = {
        ...validProjectExport,
        testSuites: [
          {
            _exportId: "ts1",
            name: "Test Suite",
            targetType: "prompt" as const,
            targetRef: "prompt-exp-1",
            testCases: [],
            validationRules: [
              {
                type: "invalidType",
                value: "test",
                severity: "fail" as const,
              },
            ],
            llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
          },
        ],
      };

      const result = validateProjectExport(withValidationRules);

      expect(result.success).toBe(false);
    });

    it("should accept all valid validation rule types", () => {
      const ruleTypes = [
        { type: "contains", value: "test" },
        { type: "excludes", value: "bad" },
        { type: "minLength", value: 10 },
        { type: "maxLength", value: 100 },
        { type: "regex", value: "^test" },
        { type: "jsonSchema", value: '{"type":"object"}' },
        { type: "maxResponseTime", value: 5000 },
      ];

      for (const rule of ruleTypes) {
        const withRule = {
          ...validProjectExport,
          testSuites: [
            {
              _exportId: "ts1",
              name: "Test Suite",
              targetType: "prompt" as const,
              targetRef: "prompt-exp-1",
              testCases: [],
              validationRules: [{ ...rule, severity: "fail" as const }],
              llmJudgeConfig: { enabled: false, criteria: [], validationRules: [] },
            },
          ],
        };

        const result = validateProjectExport(withRule);
        expect(result.success).toBe(true);
      }
    });

    it("should validate model config provider", () => {
      const withInvalidProvider = {
        ...validProjectExport,
        prompts: [
          {
            _exportId: "p1",
            name: "Test Prompt",
            versions: [
              {
                version: 1,
                content: "Hello",
                variables: [],
                modelConfig: {
                  provider: "invalid" as const,
                },
              },
            ],
            currentVersion: 1,
            tags: [],
          },
        ],
      };

      const result = validateProjectExport(withInvalidProvider);

      expect(result.success).toBe(false);
    });

    it("should accept all valid providers", () => {
      const providers = ["openai", "anthropic", "gemini", "custom"] as const;

      for (const provider of providers) {
        const withProvider = {
          ...validProjectExport,
          prompts: [
            {
              _exportId: "p1",
              name: "Test Prompt",
              versions: [
                {
                  version: 1,
                  content: "Hello",
                  variables: [],
                  modelConfig: { provider },
                },
              ],
              currentVersion: 1,
              tags: [],
            },
          ],
        };

        const result = validateProjectExport(withProvider);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("formatZodErrors", () => {
    it("should format Zod errors correctly", () => {
      const invalid = {
        ...validProjectExport,
        project: { name: "", visibility: "invalid" },
      };

      const result = validateProjectExport(invalid);

      if (!result.success) {
        const errors = formatZodErrors(result.error);

        expect(Array.isArray(errors)).toBe(true);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toHaveProperty("path");
        expect(errors[0]).toHaveProperty("message");
        expect(errors[0]).toHaveProperty("code");
      }
    });

    it("should join path segments with dots", () => {
      const invalid = {
        ...validProjectExport,
        prompts: [{ _exportId: "p1", name: "", versions: [], currentVersion: 1, tags: [] }],
      };

      const result = validateProjectExport(invalid);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        const promptError = errors.find((e) => e.path.includes("prompts"));

        expect(promptError).toBeDefined();
        expect(promptError?.path).toContain(".");
      }
    });
  });
});
