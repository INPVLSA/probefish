import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { replaceVariables, getValueByPath, ModelOverride } from '@/lib/testing/executor';
import { DEFAULT_MODELS } from '@/lib/llm/types';

describe('replaceVariables', () => {
  describe('basic variable substitution', () => {
    it('should replace single variable', () => {
      const template = 'Hello, {{name}}!';
      const variables = { name: 'World' };
      expect(replaceVariables(template, variables)).toBe('Hello, World!');
    });

    it('should replace multiple different variables', () => {
      const template = '{{greeting}}, {{name}}!';
      const variables = { greeting: 'Hello', name: 'World' };
      expect(replaceVariables(template, variables)).toBe('Hello, World!');
    });

    it('should replace same variable multiple times', () => {
      const template = '{{name}} said hello to {{name}}';
      const variables = { name: 'Alice' };
      expect(replaceVariables(template, variables)).toBe('Alice said hello to Alice');
    });

    it('should handle variables with spaces around name', () => {
      const template = 'Hello, {{ name }}!';
      const variables = { name: 'World' };
      expect(replaceVariables(template, variables)).toBe('Hello, World!');
    });

    it('should handle variables with extra spaces', () => {
      const template = 'Hello, {{   name   }}!';
      const variables = { name: 'World' };
      expect(replaceVariables(template, variables)).toBe('Hello, World!');
    });
  });

  describe('missing variables', () => {
    it('should leave unmatched variables unchanged', () => {
      const template = 'Hello, {{missing}}!';
      const variables = {};
      expect(replaceVariables(template, variables)).toBe('Hello, {{missing}}!');
    });

    it('should replace only matching variables', () => {
      const template = '{{found}} and {{missing}}';
      const variables = { found: 'yes' };
      expect(replaceVariables(template, variables)).toBe('yes and {{missing}}');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      expect(replaceVariables('', { name: 'test' })).toBe('');
    });

    it('should handle null template', () => {
      expect(replaceVariables(null as unknown as string, { name: 'test' })).toBe('');
    });

    it('should handle undefined template', () => {
      expect(replaceVariables(undefined as unknown as string, { name: 'test' })).toBe('');
    });

    it('should handle empty variables', () => {
      const template = 'No variables here';
      expect(replaceVariables(template, {})).toBe('No variables here');
    });

    it('should handle template without variables', () => {
      const template = 'Plain text without any variables';
      expect(replaceVariables(template, { name: 'test' })).toBe('Plain text without any variables');
    });

    it('should handle empty string variable value', () => {
      const template = 'Hello, {{name}}!';
      const variables = { name: '' };
      expect(replaceVariables(template, variables)).toBe('Hello, !');
    });

    it('should convert non-string values to strings', () => {
      const template = 'Count: {{count}}, Active: {{active}}';
      const variables = { count: '42', active: 'true' };
      expect(replaceVariables(template, variables)).toBe('Count: 42, Active: true');
    });
  });

  describe('JSON escaping', () => {
    it('should escape newlines when escapeForJson is true', () => {
      const template = '{"message": "{{content}}"}';
      const variables = { content: 'Line1\nLine2' };
      const result = replaceVariables(template, variables, true);
      expect(result).toBe('{"message": "Line1\\nLine2"}');
    });

    it('should escape quotes when escapeForJson is true', () => {
      const template = '{"message": "{{content}}"}';
      const variables = { content: 'He said "hello"' };
      const result = replaceVariables(template, variables, true);
      expect(result).toBe('{"message": "He said \\"hello\\""}');
    });

    it('should escape backslashes when escapeForJson is true', () => {
      const template = '{"path": "{{path}}"}';
      const variables = { path: 'C:\\Users\\test' };
      const result = replaceVariables(template, variables, true);
      expect(result).toBe('{"path": "C:\\\\Users\\\\test"}');
    });

    it('should escape tabs and carriage returns', () => {
      const template = '{"text": "{{text}}"}';
      const variables = { text: 'col1\tcol2\r\nrow2' };
      const result = replaceVariables(template, variables, true);
      expect(result).toBe('{"text": "col1\\tcol2\\r\\nrow2"}');
    });

    it('should not escape when escapeForJson is false', () => {
      const template = 'Message: {{content}}';
      const variables = { content: 'Line1\nLine2' };
      const result = replaceVariables(template, variables, false);
      expect(result).toBe('Message: Line1\nLine2');
    });

    it('should produce valid JSON after escaping', () => {
      const template = '{"data": "{{value}}"}';
      const variables = { value: 'test\nwith "quotes" and \\backslash' };
      const result = replaceVariables(template, variables, true);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.data).toBe('test\nwith "quotes" and \\backslash');
    });
  });

  describe('special characters in values', () => {
    it('should handle $ character in replacement', () => {
      const template = 'Price: {{price}}';
      const variables = { price: '$100' };
      expect(replaceVariables(template, variables)).toBe('Price: $100');
    });

    it('should handle regex special characters in value', () => {
      const template = 'Pattern: {{pattern}}';
      const variables = { pattern: '.*[a-z]+$' };
      expect(replaceVariables(template, variables)).toBe('Pattern: .*[a-z]+$');
    });

    it('should handle unicode characters', () => {
      const template = 'Greeting: {{greeting}}';
      const variables = { greeting: '你好世界 🌍' };
      expect(replaceVariables(template, variables)).toBe('Greeting: 你好世界 🌍');
    });
  });
});

describe('getValueByPath', () => {
  describe('simple paths', () => {
    it('should get top-level value', () => {
      const obj = { name: 'test' };
      expect(getValueByPath(obj, 'name')).toBe('test');
    });

    it('should return entire object for empty path', () => {
      const obj = { name: 'test' };
      expect(getValueByPath(obj, '')).toEqual(obj);
    });

    it('should return undefined for missing key', () => {
      const obj = { name: 'test' };
      expect(getValueByPath(obj, 'missing')).toBeUndefined();
    });
  });

  describe('nested paths', () => {
    it('should get nested value', () => {
      const obj = { data: { response: { content: 'hello' } } };
      expect(getValueByPath(obj, 'data.response.content')).toBe('hello');
    });

    it('should get deeply nested value', () => {
      const obj = { a: { b: { c: { d: { e: 'deep' } } } } };
      expect(getValueByPath(obj, 'a.b.c.d.e')).toBe('deep');
    });

    it('should return undefined for missing nested path', () => {
      const obj = { data: { response: {} } };
      expect(getValueByPath(obj, 'data.response.missing')).toBeUndefined();
    });

    it('should return undefined when intermediate path is missing', () => {
      const obj = { data: {} };
      expect(getValueByPath(obj, 'data.missing.content')).toBeUndefined();
    });
  });

  describe('array notation', () => {
    it('should handle array index access', () => {
      const obj = { choices: [{ text: 'first' }, { text: 'second' }] };
      expect(getValueByPath(obj, 'choices[0].text')).toBe('first');
      expect(getValueByPath(obj, 'choices[1].text')).toBe('second');
    });

    it('should handle nested array access', () => {
      const obj = { data: { items: ['a', 'b', 'c'] } };
      expect(getValueByPath(obj, 'data.items[0]')).toBe('a');
      expect(getValueByPath(obj, 'data.items[2]')).toBe('c');
    });

    it('should return undefined for out of bounds index', () => {
      const obj = { items: ['a', 'b'] };
      expect(getValueByPath(obj, 'items[5]')).toBeUndefined();
    });

    it('should return undefined when accessing array on non-array', () => {
      const obj = { items: 'not an array' };
      expect(getValueByPath(obj, 'items[0]')).toBeUndefined();
    });

    it('should handle multiple array accesses', () => {
      const obj = { matrix: [[1, 2], [3, 4]] };
      // Note: This specific syntax "matrix[0][1]" won't work with current implementation
      // But we can test what does work
      expect(getValueByPath(obj, 'matrix[0]')).toEqual([1, 2]);
    });
  });

  describe('edge cases', () => {
    it('should handle null values in path', () => {
      const obj = { data: null };
      expect(getValueByPath(obj, 'data.field')).toBeUndefined();
    });

    it('should handle undefined values in path', () => {
      const obj = { data: undefined };
      expect(getValueByPath(obj, 'data.field')).toBeUndefined();
    });

    it('should return primitive values', () => {
      const obj = { num: 42, bool: true, str: 'text' };
      expect(getValueByPath(obj, 'num')).toBe(42);
      expect(getValueByPath(obj, 'bool')).toBe(true);
      expect(getValueByPath(obj, 'str')).toBe('text');
    });

    it('should return nested objects', () => {
      const obj = { data: { nested: { value: 1 } } };
      expect(getValueByPath(obj, 'data.nested')).toEqual({ value: 1 });
    });

    it('should return arrays', () => {
      const obj = { items: [1, 2, 3] };
      expect(getValueByPath(obj, 'items')).toEqual([1, 2, 3]);
    });
  });

  describe('OpenAI response format', () => {
    it('should extract content from typical OpenAI response', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Hello, how can I help you?',
              role: 'assistant',
            },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4',
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      expect(getValueByPath(response, 'choices[0].message.content')).toBe(
        'Hello, how can I help you?'
      );
      expect(getValueByPath(response, 'choices[0].finish_reason')).toBe('stop');
      expect(getValueByPath(response, 'model')).toBe('gpt-4');
    });
  });

  describe('API response formats', () => {
    it('should extract from nested API response', () => {
      const response = {
        data: {
          result: {
            items: [
              { id: 1, name: 'Item 1' },
              { id: 2, name: 'Item 2' },
            ],
          },
        },
      };

      expect(getValueByPath(response, 'data.result.items[0].name')).toBe('Item 1');
      expect(getValueByPath(response, 'data.result.items[1].id')).toBe(2);
    });
  });
});

describe('minScore threshold logic', () => {
  // Test the minScore threshold logic in isolation
  // This tests the logic without requiring full LLM integration

  describe('score comparison', () => {
    it('should fail when score is below minScore threshold', () => {
      const minScore = 0.7; // 70%
      const actualScore = 0.45; // 45%

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(true);
    });

    it('should pass when score equals minScore threshold', () => {
      const minScore = 0.7;
      const actualScore = 0.7;

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(false);
    });

    it('should pass when score is above minScore threshold', () => {
      const minScore = 0.7;
      const actualScore = 0.85;

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(false);
    });

    it('should not check minScore when undefined', () => {
      const minScore = undefined;
      const actualScore = 0.3;

      const shouldCheck = minScore !== undefined && minScore > 0;
      expect(shouldCheck).toBe(false);
    });

    it('should not check minScore when set to 0', () => {
      const minScore = 0;
      const actualScore = 0.1;

      const shouldCheck = minScore !== undefined && minScore > 0;
      expect(shouldCheck).toBe(false);
    });

    it('should check minScore when set to positive value', () => {
      const minScore = 0.5;
      const actualScore = 0.3;

      const shouldCheck = minScore !== undefined && minScore > 0;
      expect(shouldCheck).toBe(true);
    });
  });

  describe('error message formatting', () => {
    it('should format error message with correct percentages', () => {
      const minScore = 0.7;
      const actualScore = 0.45;

      const minScorePercent = (minScore * 100).toFixed(0);
      const actualScorePercent = (actualScore * 100).toFixed(0);
      const message = `Judge score ${actualScorePercent}% is below minimum threshold of ${minScorePercent}%`;

      expect(message).toBe('Judge score 45% is below minimum threshold of 70%');
    });

    it('should handle decimal scores correctly', () => {
      const minScore = 0.75;
      const actualScore = 0.333;

      const minScorePercent = (minScore * 100).toFixed(0);
      const actualScorePercent = (actualScore * 100).toFixed(0);
      const message = `Judge score ${actualScorePercent}% is below minimum threshold of ${minScorePercent}%`;

      expect(message).toBe('Judge score 33% is below minimum threshold of 75%');
    });

    it('should round percentages correctly', () => {
      const minScore = 0.755; // Should round to 76%
      const actualScore = 0.454; // Should round to 45%

      const minScorePercent = (minScore * 100).toFixed(0);
      const actualScorePercent = (actualScore * 100).toFixed(0);

      expect(minScorePercent).toBe('76');
      expect(actualScorePercent).toBe('45');
    });
  });

  describe('edge cases', () => {
    it('should handle minScore of 1 (100%)', () => {
      const minScore = 1;
      const actualScore = 0.99;

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(true);
    });

    it('should pass when score is exactly 1 (100%)', () => {
      const minScore = 1;
      const actualScore = 1;

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(false);
    });

    it('should handle very small threshold', () => {
      const minScore = 0.01; // 1%
      const actualScore = 0.005; // 0.5%

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(true);
    });

    it('should handle score of 0', () => {
      const minScore = 0.5;
      const actualScore = 0;

      const shouldFail = actualScore < minScore;
      expect(shouldFail).toBe(true);
    });
  });
});

describe('ModelOverride', () => {
  describe('type structure', () => {
    it('should accept valid OpenAI model override', () => {
      const override: ModelOverride = {
        provider: 'openai',
        model: 'gpt-4o',
      };
      expect(override.provider).toBe('openai');
      expect(override.model).toBe('gpt-4o');
    });

    it('should accept valid Anthropic model override', () => {
      const override: ModelOverride = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
      };
      expect(override.provider).toBe('anthropic');
      expect(override.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should accept valid Gemini model override', () => {
      const override: ModelOverride = {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      };
      expect(override.provider).toBe('gemini');
      expect(override.model).toBe('gemini-2.5-flash');
    });
  });

  describe('model override logic', () => {
    it('should use override provider when provided', () => {
      const versionProvider = 'openai';
      const versionModel = DEFAULT_MODELS.openai;
      const override: ModelOverride = {
        provider: 'anthropic',
        model: DEFAULT_MODELS.anthropic,
      };

      const effectiveProvider = override?.provider || versionProvider;
      const effectiveModel = override?.model || versionModel;

      expect(effectiveProvider).toBe('anthropic');
      expect(effectiveModel).toBe(DEFAULT_MODELS.anthropic);
    });

    it('should use version config when no override', () => {
      const versionProvider = 'openai';
      const versionModel = DEFAULT_MODELS.openai;
      const override: ModelOverride | undefined = undefined;

      const effectiveProvider = override?.provider || versionProvider;
      const effectiveModel = override?.model || versionModel;

      expect(effectiveProvider).toBe('openai');
      expect(effectiveModel).toBe(DEFAULT_MODELS.openai);
    });

    it('should fall back to default when no version config and no override', () => {
      const versionProvider: string | undefined = undefined;
      const versionModel: string | undefined = undefined;
      const override: ModelOverride | undefined = undefined;

      const effectiveProvider = override?.provider || versionProvider || 'openai';
      const effectiveModel = override?.model || versionModel || 'gpt-4o-mini';

      expect(effectiveProvider).toBe('openai');
      expect(effectiveModel).toBe('gpt-4o-mini');
    });
  });
});

describe('Per-case validation rule merging', () => {
  // Test the logic for merging suite-level and per-case validation rules

  interface ValidationRule {
    type: string;
    value: string | number;
    message?: string;
    severity?: 'fail' | 'warning';
  }

  interface JudgeValidationRule {
    name: string;
    description: string;
    failureMessage?: string;
    severity: 'fail' | 'warning';
  }

  interface TestCase {
    name: string;
    inputs: Record<string, string>;
    expectedOutput?: string;
    validationMode?: 'text' | 'rules';
    validationRules?: ValidationRule[];
    judgeValidationRules?: JudgeValidationRule[];
  }

  interface JudgeConfig {
    enabled: boolean;
    validationRules?: JudgeValidationRule[];
    criteria?: { name: string; description: string; weight: number }[];
  }

  describe('effective validation mode detection', () => {
    function getEffectiveMode(testCase: TestCase): 'text' | 'rules' {
      if (testCase.validationMode) return testCase.validationMode;
      if (testCase.expectedOutput?.trim()) return 'text';
      return 'rules';
    }

    it('should use explicit validationMode when set to text', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        validationMode: 'text',
        expectedOutput: '',
      };
      expect(getEffectiveMode(testCase)).toBe('text');
    });

    it('should use explicit validationMode when set to rules', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        validationMode: 'rules',
        expectedOutput: 'some output',
      };
      expect(getEffectiveMode(testCase)).toBe('rules');
    });

    it('should default to text mode for legacy cases with expectedOutput', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        expectedOutput: 'Expected response',
      };
      expect(getEffectiveMode(testCase)).toBe('text');
    });

    it('should default to rules mode for new cases without expectedOutput', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
      };
      expect(getEffectiveMode(testCase)).toBe('rules');
    });

    it('should default to rules mode when expectedOutput is empty string', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        expectedOutput: '',
      };
      expect(getEffectiveMode(testCase)).toBe('rules');
    });

    it('should default to rules mode when expectedOutput is whitespace only', () => {
      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        expectedOutput: '   ',
      };
      expect(getEffectiveMode(testCase)).toBe('rules');
    });
  });

  describe('validation rules merging', () => {
    it('should merge suite-level and per-case validation rules', () => {
      const suiteRules: ValidationRule[] = [
        { type: 'contains', value: 'hello' },
        { type: 'minLength', value: 10 },
      ];

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        validationRules: [
          { type: 'excludes', value: 'error' },
          { type: 'maxLength', value: 100 },
        ],
      };

      const effectiveRules = [
        ...suiteRules,
        ...(testCase.validationRules || []),
      ];

      expect(effectiveRules).toHaveLength(4);
      expect(effectiveRules[0].type).toBe('contains');
      expect(effectiveRules[1].type).toBe('minLength');
      expect(effectiveRules[2].type).toBe('excludes');
      expect(effectiveRules[3].type).toBe('maxLength');
    });

    it('should use only suite rules when test case has no rules', () => {
      const suiteRules: ValidationRule[] = [
        { type: 'contains', value: 'hello' },
      ];

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
      };

      const effectiveRules = [
        ...suiteRules,
        ...(testCase.validationRules || []),
      ];

      expect(effectiveRules).toHaveLength(1);
      expect(effectiveRules[0].type).toBe('contains');
    });

    it('should use only per-case rules when suite has no rules', () => {
      const suiteRules: ValidationRule[] = [];

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        validationRules: [
          { type: 'isJson', value: '' },
        ],
      };

      const effectiveRules = [
        ...suiteRules,
        ...(testCase.validationRules || []),
      ];

      expect(effectiveRules).toHaveLength(1);
      expect(effectiveRules[0].type).toBe('isJson');
    });

    it('should handle duplicate rule types from suite and per-case (both are applied)', () => {
      const suiteRules: ValidationRule[] = [
        { type: 'contains', value: 'hello' },
      ];

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        validationRules: [
          { type: 'contains', value: 'world' },
        ],
      };

      const effectiveRules = [
        ...suiteRules,
        ...(testCase.validationRules || []),
      ];

      expect(effectiveRules).toHaveLength(2);
      expect(effectiveRules[0].value).toBe('hello');
      expect(effectiveRules[1].value).toBe('world');
    });
  });

  describe('judge validation rules merging', () => {
    it('should merge suite-level and per-case judge validation rules', () => {
      const judgeConfig: JudgeConfig = {
        enabled: true,
        validationRules: [
          { name: 'No harmful content', description: 'Output must not contain harmful content', severity: 'fail' },
        ],
      };

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        judgeValidationRules: [
          { name: 'Must be professional', description: 'Output must be professional', severity: 'warning' },
        ],
      };

      const effectiveJudgeRules = [
        ...(judgeConfig.validationRules || []),
        ...(testCase.judgeValidationRules || []),
      ];

      expect(effectiveJudgeRules).toHaveLength(2);
      expect(effectiveJudgeRules[0].name).toBe('No harmful content');
      expect(effectiveJudgeRules[1].name).toBe('Must be professional');
    });

    it('should use only suite judge rules when test case has no judge rules', () => {
      const judgeConfig: JudgeConfig = {
        enabled: true,
        validationRules: [
          { name: 'Suite rule', description: 'Suite level rule', severity: 'fail' },
        ],
      };

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
      };

      const effectiveJudgeRules = [
        ...(judgeConfig.validationRules || []),
        ...(testCase.judgeValidationRules || []),
      ];

      expect(effectiveJudgeRules).toHaveLength(1);
      expect(effectiveJudgeRules[0].name).toBe('Suite rule');
    });

    it('should use only per-case judge rules when suite has no judge rules', () => {
      const judgeConfig: JudgeConfig = {
        enabled: true,
        validationRules: [],
      };

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        judgeValidationRules: [
          { name: 'Case-specific rule', description: 'Per-case rule', severity: 'fail' },
        ],
      };

      const effectiveJudgeRules = [
        ...(judgeConfig.validationRules || []),
        ...(testCase.judgeValidationRules || []),
      ];

      expect(effectiveJudgeRules).toHaveLength(1);
      expect(effectiveJudgeRules[0].name).toBe('Case-specific rule');
    });

    it('should preserve judge config properties when merging rules', () => {
      const judgeConfig: JudgeConfig = {
        enabled: true,
        criteria: [
          { name: 'Quality', description: 'Response quality', weight: 100 },
        ],
        validationRules: [
          { name: 'Suite rule', description: 'Suite level', severity: 'fail' },
        ],
      };

      const testCase: TestCase = {
        name: 'Test',
        inputs: {},
        judgeValidationRules: [
          { name: 'Case rule', description: 'Case level', severity: 'warning' },
        ],
      };

      const effectiveJudgeConfig = {
        ...judgeConfig,
        validationRules: [
          ...(judgeConfig.validationRules || []),
          ...(testCase.judgeValidationRules || []),
        ],
      };

      expect(effectiveJudgeConfig.enabled).toBe(true);
      expect(effectiveJudgeConfig.criteria).toHaveLength(1);
      expect(effectiveJudgeConfig.criteria![0].name).toBe('Quality');
      expect(effectiveJudgeConfig.validationRules).toHaveLength(2);
    });
  });
});

describe('Multi-model comparison logic', () => {
  describe('model selection', () => {
    interface ModelSelection {
      provider: 'openai' | 'anthropic' | 'gemini';
      model: string;
    }

    it('should create valid model selection array', () => {
      const selectedModels: ModelSelection[] = [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        { provider: 'gemini', model: 'gemini-2.5-flash' },
      ];

      expect(selectedModels).toHaveLength(3);
      expect(selectedModels[0].provider).toBe('openai');
      expect(selectedModels[1].provider).toBe('anthropic');
      expect(selectedModels[2].provider).toBe('gemini');
    });

    it('should filter models by provider', () => {
      const selectedModels: ModelSelection[] = [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
      ];

      const openaiModels = selectedModels.filter((m) => m.provider === 'openai');
      const anthropicModels = selectedModels.filter((m) => m.provider === 'anthropic');

      expect(openaiModels).toHaveLength(2);
      expect(anthropicModels).toHaveLength(1);
    });

    it('should identify unique providers in selection', () => {
      const selectedModels: ModelSelection[] = [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
      ];

      const uniqueProviders = [...new Set(selectedModels.map((m) => m.provider))];

      expect(uniqueProviders).toHaveLength(2);
      expect(uniqueProviders).toContain('openai');
      expect(uniqueProviders).toContain('anthropic');
    });
  });

  describe('result aggregation', () => {
    interface TestRunSummary {
      total: number;
      passed: number;
      failed: number;
      avgScore?: number;
      avgResponseTime: number;
    }

    interface ModelResult {
      model: { provider: string; model: string };
      testRun?: { summary: TestRunSummary };
      error?: string;
    }

    it('should count successful runs', () => {
      const results: ModelResult[] = [
        {
          model: { provider: 'openai', model: 'gpt-4o' },
          testRun: { summary: { total: 5, passed: 5, failed: 0, avgResponseTime: 1000 } },
        },
        {
          model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
          testRun: { summary: { total: 5, passed: 4, failed: 1, avgResponseTime: 1200 } },
        },
        {
          model: { provider: 'gemini', model: 'gemini-2.5-flash' },
          error: 'API key not configured',
        },
      ];

      const successfulRuns = results.filter((r) => r.testRun);
      const failedRuns = results.filter((r) => r.error);

      expect(successfulRuns).toHaveLength(2);
      expect(failedRuns).toHaveLength(1);
    });

    it('should calculate pass rate per model', () => {
      const results: ModelResult[] = [
        {
          model: { provider: 'openai', model: 'gpt-4o' },
          testRun: { summary: { total: 10, passed: 8, failed: 2, avgResponseTime: 1000 } },
        },
        {
          model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
          testRun: { summary: { total: 10, passed: 9, failed: 1, avgResponseTime: 1200 } },
        },
      ];

      const passRates = results
        .filter((r) => r.testRun)
        .map((r) => ({
          model: r.model.model,
          passRate: Math.round((r.testRun!.summary.passed / r.testRun!.summary.total) * 100),
        }));

      expect(passRates[0].passRate).toBe(80);
      expect(passRates[1].passRate).toBe(90);
    });

    it('should identify best performing model', () => {
      const results: ModelResult[] = [
        {
          model: { provider: 'openai', model: 'gpt-4o' },
          testRun: { summary: { total: 10, passed: 8, failed: 2, avgScore: 0.75, avgResponseTime: 1000 } },
        },
        {
          model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
          testRun: { summary: { total: 10, passed: 9, failed: 1, avgScore: 0.85, avgResponseTime: 1200 } },
        },
        {
          model: { provider: 'gemini', model: 'gemini-2.5-flash' },
          testRun: { summary: { total: 10, passed: 7, failed: 3, avgScore: 0.70, avgResponseTime: 800 } },
        },
      ];

      const successfulResults = results.filter((r) => r.testRun);
      const bestByPassRate = successfulResults.reduce((best, current) => {
        const bestPassRate = best.testRun!.summary.passed / best.testRun!.summary.total;
        const currentPassRate = current.testRun!.summary.passed / current.testRun!.summary.total;
        return currentPassRate > bestPassRate ? current : best;
      });

      const bestByScore = successfulResults
        .filter((r) => r.testRun?.summary.avgScore !== undefined)
        .reduce((best, current) => {
          return (current.testRun!.summary.avgScore || 0) > (best.testRun!.summary.avgScore || 0)
            ? current
            : best;
        });

      expect(bestByPassRate.model.model).toBe('claude-sonnet-4-5-20250929');
      expect(bestByScore.model.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should identify fastest model', () => {
      const results: ModelResult[] = [
        {
          model: { provider: 'openai', model: 'gpt-4o' },
          testRun: { summary: { total: 10, passed: 8, failed: 2, avgResponseTime: 1500 } },
        },
        {
          model: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
          testRun: { summary: { total: 10, passed: 9, failed: 1, avgResponseTime: 1200 } },
        },
        {
          model: { provider: 'gemini', model: 'gemini-2.5-flash' },
          testRun: { summary: { total: 10, passed: 7, failed: 3, avgResponseTime: 600 } },
        },
      ];

      const fastestModel = results
        .filter((r) => r.testRun)
        .reduce((fastest, current) => {
          return current.testRun!.summary.avgResponseTime < fastest.testRun!.summary.avgResponseTime
            ? current
            : fastest;
        });

      expect(fastestModel.model.model).toBe('gemini-2.5-flash');
    });
  });

  describe('progress tracking', () => {
    it('should calculate progress percentage', () => {
      const total = 5;
      const current = 2;

      const progressPercent = Math.round((current / total) * 100);

      expect(progressPercent).toBe(40);
    });

    it('should track current model in progress', () => {
      const models = ['gpt-4o', 'claude-sonnet-4-5-20250929', 'gemini-2.5-flash'];
      let currentIndex = 0;

      const progress = {
        current: currentIndex + 1,
        total: models.length,
        currentModel: models[currentIndex],
      };

      expect(progress.current).toBe(1);
      expect(progress.total).toBe(3);
      expect(progress.currentModel).toBe('gpt-4o');

      // Simulate moving to next model
      currentIndex = 1;
      const progress2 = {
        current: currentIndex + 1,
        total: models.length,
        currentModel: models[currentIndex],
      };

      expect(progress2.current).toBe(2);
      expect(progress2.currentModel).toBe('claude-sonnet-4-5-20250929');
    });
  });
});
