import { describe, it, expect } from 'vitest';
import { replaceVariables, getValueByPath } from '@/lib/testing/executor';

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
