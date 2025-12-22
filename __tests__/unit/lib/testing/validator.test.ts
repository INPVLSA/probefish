import { describe, it, expect } from 'vitest';
import { validate } from '@/lib/testing/validator';
import type { IValidationRule } from '@/lib/db/models/testSuite';

describe('validate', () => {
  describe('contains rule', () => {
    it('should pass when output contains expected string', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'hello' },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when output does not contain expected string', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'goodbye' },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('goodbye');
    });

    it('should use custom message when provided', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'missing', message: 'Custom error message' },
      ];
      const result = validate('hello world', rules);
      expect(result.errors[0]).toBe('Custom error message');
    });

    it('should be case-sensitive', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'Hello' },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(false);
    });
  });

  describe('excludes rule', () => {
    it('should pass when output does not contain excluded string', () => {
      const rules: IValidationRule[] = [
        { type: 'excludes', value: 'error' },
      ];
      const result = validate('success message', rules);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when output contains excluded string', () => {
      const rules: IValidationRule[] = [
        { type: 'excludes', value: 'error' },
      ];
      const result = validate('an error occurred', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('error');
    });

    it('should use custom message when provided', () => {
      const rules: IValidationRule[] = [
        { type: 'excludes', value: 'bad', message: 'No bad words allowed' },
      ];
      const result = validate('this is bad', rules);
      expect(result.errors[0]).toBe('No bad words allowed');
    });
  });

  describe('minLength rule', () => {
    it('should pass when output meets minimum length', () => {
      const rules: IValidationRule[] = [
        { type: 'minLength', value: 5 },
      ];
      const result = validate('hello', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass when output exceeds minimum length', () => {
      const rules: IValidationRule[] = [
        { type: 'minLength', value: 5 },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail when output is shorter than minimum', () => {
      const rules: IValidationRule[] = [
        { type: 'minLength', value: 10 },
      ];
      const result = validate('hello', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('minimum 10');
    });

    it('should handle empty string', () => {
      const rules: IValidationRule[] = [
        { type: 'minLength', value: 1 },
      ];
      const result = validate('', rules);
      expect(result.passed).toBe(false);
    });
  });

  describe('maxLength rule', () => {
    it('should pass when output is within maximum length', () => {
      const rules: IValidationRule[] = [
        { type: 'maxLength', value: 100 },
      ];
      const result = validate('short text', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass when output equals maximum length', () => {
      const rules: IValidationRule[] = [
        { type: 'maxLength', value: 5 },
      ];
      const result = validate('hello', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail when output exceeds maximum length', () => {
      const rules: IValidationRule[] = [
        { type: 'maxLength', value: 5 },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('maximum 5');
    });
  });

  describe('regex rule', () => {
    it('should pass when output matches regex pattern', () => {
      const rules: IValidationRule[] = [
        { type: 'regex', value: '^[A-Z][a-z]+$' },
      ];
      const result = validate('Hello', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail when output does not match regex', () => {
      const rules: IValidationRule[] = [
        { type: 'regex', value: '^\\d+$' },
      ];
      const result = validate('abc', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('pattern');
    });

    it('should handle email pattern', () => {
      const rules: IValidationRule[] = [
        { type: 'regex', value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
      ];
      expect(validate('test@example.com', rules).passed).toBe(true);
      expect(validate('invalid-email', rules).passed).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      const rules: IValidationRule[] = [
        { type: 'regex', value: '[invalid(' },
      ];
      const result = validate('test', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('error');
    });
  });

  describe('jsonSchema rule', () => {
    it('should pass for valid JSON matching schema', () => {
      const schema = JSON.stringify({
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      });
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: schema },
      ];
      const result = validate('{"name": "test"}', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid JSON', () => {
      const schema = JSON.stringify({ type: 'object' });
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: schema },
      ];
      const result = validate('not json', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('not valid JSON');
    });

    it('should fail when required property is missing', () => {
      const schema = JSON.stringify({
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      });
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: schema },
      ];
      const result = validate('{"name": "test"}', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('email');
    });

    it('should validate nested objects', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              age: { type: 'number' },
            },
          },
        },
      });
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: schema },
      ];
      expect(validate('{"user": {"age": 25}}', rules).passed).toBe(true);
      expect(validate('{"user": {"age": "twenty"}}', rules).passed).toBe(false);
    });

    it('should validate arrays', () => {
      const schema = JSON.stringify({
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      });
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: schema },
      ];
      expect(validate('["a", "b"]', rules).passed).toBe(true);
      expect(validate('[]', rules).passed).toBe(false);
    });

    it('should handle invalid schema gracefully', () => {
      const rules: IValidationRule[] = [
        { type: 'jsonSchema', value: 'not valid json schema' },
      ];
      const result = validate('{"name": "test"}', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON schema');
    });
  });

  describe('maxResponseTime rule', () => {
    it('should pass when response time is within limit', () => {
      const rules: IValidationRule[] = [
        { type: 'maxResponseTime', value: 5000 },
      ];
      const result = validate('output', rules, 3000);
      expect(result.passed).toBe(true);
    });

    it('should pass when response time equals limit', () => {
      const rules: IValidationRule[] = [
        { type: 'maxResponseTime', value: 1000 },
      ];
      const result = validate('output', rules, 1000);
      expect(result.passed).toBe(true);
    });

    it('should fail when response time exceeds limit', () => {
      const rules: IValidationRule[] = [
        { type: 'maxResponseTime', value: 1000 },
      ];
      const result = validate('output', rules, 2000);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('2000ms');
      expect(result.errors[0]).toContain('1000ms');
    });

    it('should skip validation when responseTime is undefined', () => {
      const rules: IValidationRule[] = [
        { type: 'maxResponseTime', value: 1000 },
      ];
      const result = validate('output', rules);
      expect(result.passed).toBe(true);
    });
  });

  describe('multiple rules', () => {
    it('should pass when all rules pass', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'hello' },
        { type: 'minLength', value: 5 },
        { type: 'maxLength', value: 20 },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if any rule fails', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'hello' },
        { type: 'minLength', value: 100 },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should collect all errors when multiple rules fail', () => {
      const rules: IValidationRule[] = [
        { type: 'contains', value: 'missing' },
        { type: 'minLength', value: 100 },
        { type: 'excludes', value: 'hello' },
      ];
      const result = validate('hello world', rules);
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('empty rules', () => {
    it('should pass when no rules are provided', () => {
      const result = validate('any output', []);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isJson rule', () => {
    it('should pass for valid JSON object', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('{"name": "test", "value": 123}', rules);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for valid JSON array', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('[1, 2, 3]', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass for JSON wrapped in ```json ``` code block', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('```json\n{"name": "test"}\n```', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass for JSON wrapped in ``` ``` code block without language', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('```\n{"name": "test"}\n```', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid JSON', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('not valid json', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('not valid JSON');
    });

    it('should fail for JSON with syntax error', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      const result = validate('{"name": "test",}', rules);
      expect(result.passed).toBe(false);
    });

    it('should pass for primitive JSON values', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '' },
      ];
      expect(validate('"string"', rules).passed).toBe(true);
      expect(validate('123', rules).passed).toBe(true);
      expect(validate('true', rules).passed).toBe(true);
      expect(validate('null', rules).passed).toBe(true);
    });

    it('should use custom message when provided', () => {
      const rules: IValidationRule[] = [
        { type: 'isJson', value: '', message: 'Response must be JSON format' },
      ];
      const result = validate('not json', rules);
      expect(result.errors[0]).toBe('Response must be JSON format');
    });
  });

  describe('containsJson rule', () => {
    it('should pass when output contains JSON object', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('Here is the result: {"name": "test"}', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass when output contains JSON array', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('The items are: [1, 2, 3] as shown above', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass when JSON is in ```json ``` code block', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('Here is the output:\n```json\n{"result": true}\n```\nAs you can see...', rules);
      expect(result.passed).toBe(true);
    });

    it('should pass for complex nested JSON in text', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('Response: {"user": {"name": "John", "age": 30}, "active": true}', rules);
      expect(result.passed).toBe(true);
    });

    it('should fail when no valid JSON is present', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('This is just plain text with no JSON', rules);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('does not contain valid JSON');
    });

    it('should fail for text with JSON-like but invalid syntax', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('Result: {name: test}', rules);
      expect(result.passed).toBe(false);
    });

    it('should use custom message when provided', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '', message: 'Expected JSON in response' },
      ];
      const result = validate('no json here', rules);
      expect(result.errors[0]).toBe('Expected JSON in response');
    });

    it('should pass even with surrounding text', () => {
      const rules: IValidationRule[] = [
        { type: 'containsJson', value: '' },
      ];
      const result = validate('Sure! Here is your data:\n\n{"id": 1, "status": "ok"}\n\nLet me know if you need anything else.', rules);
      expect(result.passed).toBe(true);
    });
  });
});
