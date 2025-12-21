import { describe, it, expect } from "vitest";
import { toJSON } from "@/lib/export/formats/json";
import { toJUnit } from "@/lib/export/formats/junit";
import { ProjectExport, TestSuiteOnlyExport } from "@/lib/export/types";

describe("Export Formats", () => {
  const mockProjectExport: ProjectExport = {
    metadata: {
      version: "1.0",
      exportedAt: "2024-01-01T00:00:00.000Z",
      format: "json",
      source: "probefish",
      projectId: "project-123",
      projectName: "Test Project",
      scope: "project",
    },
    project: {
      name: "Test Project",
      description: "A test project",
      visibility: "private",
    },
    prompts: [
      {
        _exportId: "prompt-exp-1",
        name: "Test Prompt",
        description: "A test prompt",
        versions: [
          {
            version: 1,
            content: "Hello {{name}}",
            variables: ["name"],
            modelConfig: {
              provider: "openai",
              model: "gpt-4",
              temperature: 0.7,
            },
          },
        ],
        currentVersion: 1,
        tags: ["test"],
      },
    ],
    endpoints: [
      {
        _exportId: "endpoint-exp-1",
        name: "Test Endpoint",
        config: {
          method: "POST",
          url: "https://api.example.com/chat",
          contentType: "application/json",
        },
        variables: ["message"],
      },
    ],
    testSuites: [
      {
        _exportId: "suite-exp-1",
        name: "Test Suite",
        targetType: "prompt",
        targetRef: "prompt-exp-1",
        targetVersion: 1,
        testCases: [
          {
            name: "Test Case 1",
            inputs: { name: "World" },
            expectedOutput: "Hello World",
          },
        ],
        validationRules: [
          {
            type: "contains",
            value: "Hello",
            severity: "fail",
          },
        ],
        llmJudgeConfig: {
          enabled: false,
          criteria: [],
          validationRules: [],
        },
        runHistory: [
          {
            runAt: "2024-01-01T00:00:00.000Z",
            status: "completed",
            results: [
              {
                testCaseName: "Test Case 1",
                inputs: { name: "World" },
                output: "Hello World!",
                validationPassed: true,
                validationErrors: [],
                responseTime: 500,
              },
            ],
            summary: {
              total: 1,
              passed: 1,
              failed: 0,
              avgResponseTime: 500,
            },
          },
        ],
      },
    ],
    webhooks: [
      {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: ["test.run.completed"],
        status: "active",
        retryCount: 3,
        retryDelayMs: 1000,
      },
    ],
  };

  describe("toJSON", () => {
    it("should convert project export to JSON string", () => {
      const json = toJSON(mockProjectExport);

      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.metadata.projectName).toBe("Test Project");
      expect(parsed.prompts).toHaveLength(1);
      expect(parsed.endpoints).toHaveLength(1);
      expect(parsed.testSuites).toHaveLength(1);
      expect(parsed.webhooks).toHaveLength(1);
    });

    it("should format JSON with indentation", () => {
      const json = toJSON(mockProjectExport);

      expect(json).toContain("\n");
      expect(json).toContain("  ");
    });

    it("should handle single test suite export", () => {
      const suiteExport: TestSuiteOnlyExport = {
        metadata: {
          ...mockProjectExport.metadata,
          scope: "test-suite",
          suiteId: "suite-123",
          suiteName: "Test Suite",
        },
        testSuite: mockProjectExport.testSuites[0],
        target: {
          type: "prompt",
          data: mockProjectExport.prompts[0],
        },
      };

      const json = toJSON(suiteExport);
      const parsed = JSON.parse(json);

      expect(parsed.metadata.scope).toBe("test-suite");
      expect(parsed.testSuite.name).toBe("Test Suite");
      expect(parsed.target.type).toBe("prompt");
    });
  });

  describe("toJUnit", () => {
    it("should generate valid XML structure", () => {
      const xml = toJUnit(mockProjectExport);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain("<testsuites");
      expect(xml).toContain("<testsuite");
      expect(xml).toContain("<testcase");
      expect(xml).toContain("</testsuites>");
    });

    it("should include project name in testsuites element", () => {
      const xml = toJUnit(mockProjectExport);

      expect(xml).toContain('name="Test Project"');
    });

    it("should include test counts", () => {
      const xml = toJUnit(mockProjectExport);

      expect(xml).toContain('tests="1"');
      expect(xml).toContain('failures="0"');
      expect(xml).toContain('errors="0"');
    });

    it("should format time in seconds", () => {
      const xml = toJUnit(mockProjectExport);

      // 500ms should be 0.500 seconds
      expect(xml).toContain('time="0.500"');
    });

    it("should escape XML special characters", () => {
      const exportWithSpecialChars: ProjectExport = {
        ...mockProjectExport,
        project: {
          ...mockProjectExport.project,
          name: "Test <Project> & \"More\"",
        },
        testSuites: [
          {
            ...mockProjectExport.testSuites[0],
            name: "Suite with <special> & chars",
            runHistory: [
              {
                ...mockProjectExport.testSuites[0].runHistory![0],
                results: [
                  {
                    ...mockProjectExport.testSuites[0].runHistory![0].results[0],
                    output: "Output with <tags> & \"quotes\"",
                  },
                ],
              },
            ],
          },
        ],
      };

      const xml = toJUnit(exportWithSpecialChars);

      expect(xml).toContain("&lt;");
      expect(xml).toContain("&gt;");
      expect(xml).toContain("&amp;");
      expect(xml).toContain("&quot;");
    });

    it("should include failure elements for failed tests", () => {
      const failedExport: ProjectExport = {
        ...mockProjectExport,
        testSuites: [
          {
            ...mockProjectExport.testSuites[0],
            runHistory: [
              {
                ...mockProjectExport.testSuites[0].runHistory![0],
                results: [
                  {
                    testCaseName: "Failed Test",
                    inputs: { name: "World" },
                    output: "Wrong output",
                    validationPassed: false,
                    validationErrors: ["Expected to contain 'Hello'"],
                    responseTime: 500,
                  },
                ],
                summary: {
                  total: 1,
                  passed: 0,
                  failed: 1,
                  avgResponseTime: 500,
                },
              },
            ],
          },
        ],
      };

      const xml = toJUnit(failedExport);

      expect(xml).toContain("<failure");
      expect(xml).toContain("Expected to contain");
    });

    it("should include error elements for tests with errors", () => {
      const errorExport: ProjectExport = {
        ...mockProjectExport,
        testSuites: [
          {
            ...mockProjectExport.testSuites[0],
            runHistory: [
              {
                ...mockProjectExport.testSuites[0].runHistory![0],
                results: [
                  {
                    testCaseName: "Error Test",
                    inputs: { name: "World" },
                    output: "",
                    validationPassed: false,
                    validationErrors: [],
                    responseTime: 0,
                    error: "Connection timeout",
                  },
                ],
                summary: {
                  total: 1,
                  passed: 0,
                  failed: 1,
                  avgResponseTime: 0,
                },
              },
            ],
          },
        ],
      };

      const xml = toJUnit(errorExport);

      expect(xml).toContain("<error");
      expect(xml).toContain("Connection timeout");
    });

    it("should handle empty run history", () => {
      const noHistoryExport: ProjectExport = {
        ...mockProjectExport,
        testSuites: [
          {
            ...mockProjectExport.testSuites[0],
            runHistory: undefined,
          },
        ],
      };

      const xml = toJUnit(noHistoryExport);

      expect(xml).toContain('<testsuite name="Test Suite" tests="0"');
    });
  });
});
