import { IValidationRule } from "@/lib/db/models/testSuite";

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export function validate(
  output: string,
  rules: IValidationRule[],
  responseTime?: number
): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      switch (rule.type) {
        case "contains":
          if (!output.includes(rule.value as string)) {
            errors.push(rule.message || `Must contain: "${rule.value}"`);
          }
          break;

        case "excludes":
          if (output.includes(rule.value as string)) {
            errors.push(rule.message || `Must not contain: "${rule.value}"`);
          }
          break;

        case "minLength":
          if (output.length < (rule.value as number)) {
            errors.push(
              rule.message ||
                `Output too short: minimum ${rule.value} characters required`
            );
          }
          break;

        case "maxLength":
          if (output.length > (rule.value as number)) {
            errors.push(
              rule.message ||
                `Output too long: maximum ${rule.value} characters allowed`
            );
          }
          break;

        case "regex": {
          const regex = new RegExp(rule.value as string);
          if (!regex.test(output)) {
            errors.push(rule.message || `Must match pattern: ${rule.value}`);
          }
          break;
        }

        case "jsonSchema": {
          // Basic JSON schema validation
          const result = validateJsonSchema(output, rule.value as string);
          if (!result.valid) {
            errors.push(rule.message || result.error || "JSON schema validation failed");
          }
          break;
        }

        case "maxResponseTime":
          if (responseTime !== undefined && responseTime > (rule.value as number)) {
            errors.push(
              rule.message ||
                `Response too slow: ${responseTime}ms exceeds maximum ${rule.value}ms`
            );
          }
          break;

        case "isJson": {
          const jsonResult = validateIsJson(output);
          if (!jsonResult.valid) {
            errors.push(rule.message || jsonResult.error || "Output is not valid JSON");
          }
          break;
        }

        case "containsJson": {
          const containsResult = validateContainsJson(output);
          if (!containsResult.valid) {
            errors.push(rule.message || containsResult.error || "Output does not contain valid JSON");
          }
          break;
        }
      }
    } catch (error) {
      errors.push(
        `Validation rule error (${rule.type}): ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

// Simple JSON schema validation
function validateJsonSchema(
  output: string,
  schemaString: string
): { valid: boolean; error?: string } {
  try {
    // First, check if output is valid JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return { valid: false, error: "Output is not valid JSON" };
    }

    // Parse the schema
    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(schemaString);
    } catch {
      return { valid: false, error: "Invalid JSON schema definition" };
    }

    // Basic schema validation
    return validateAgainstSchema(parsed, schema);
  } catch {
    return { valid: false, error: "JSON schema validation failed" };
  }
}

// Basic JSON schema validator (simplified version)
function validateAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>
): { valid: boolean; error?: string } {
  // Type validation
  if (schema.type) {
    const type = getJsonType(value);
    const expectedType = schema.type as string;

    if (expectedType === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return { valid: false, error: `Expected integer, got ${type}` };
      }
    } else if (type !== expectedType) {
      return { valid: false, error: `Expected ${expectedType}, got ${type}` };
    }
  }

  // Object validation
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // Required properties
    if (Array.isArray(schema.required)) {
      for (const prop of schema.required) {
        if (!(prop in obj)) {
          return { valid: false, error: `Missing required property: ${prop}` };
        }
      }
    }

    // Property validation
    if (schema.properties && typeof schema.properties === "object") {
      const properties = schema.properties as Record<
        string,
        Record<string, unknown>
      >;
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in obj) {
          const result = validateAgainstSchema(obj[key], propSchema);
          if (!result.valid) {
            return { valid: false, error: `${key}: ${result.error}` };
          }
        }
      }
    }
  }

  // Array validation
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.items && typeof schema.items === "object") {
      for (let i = 0; i < value.length; i++) {
        const result = validateAgainstSchema(
          value[i],
          schema.items as Record<string, unknown>
        );
        if (!result.valid) {
          return { valid: false, error: `[${i}]: ${result.error}` };
        }
      }
    }

    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      return {
        valid: false,
        error: `Array too short: minimum ${schema.minItems} items required`,
      };
    }

    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      return {
        valid: false,
        error: `Array too long: maximum ${schema.maxItems} items allowed`,
      };
    }
  }

  // String validation
  if (schema.type === "string" && typeof value === "string") {
    if (
      typeof schema.minLength === "number" &&
      value.length < schema.minLength
    ) {
      return {
        valid: false,
        error: `String too short: minimum ${schema.minLength} characters`,
      };
    }

    if (
      typeof schema.maxLength === "number" &&
      value.length > schema.maxLength
    ) {
      return {
        valid: false,
        error: `String too long: maximum ${schema.maxLength} characters`,
      };
    }

    if (typeof schema.pattern === "string") {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        return { valid: false, error: `String must match pattern: ${schema.pattern}` };
      }
    }
  }

  // Number validation
  if (
    (schema.type === "number" || schema.type === "integer") &&
    typeof value === "number"
  ) {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return { valid: false, error: `Value too small: minimum ${schema.minimum}` };
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return { valid: false, error: `Value too large: maximum ${schema.maximum}` };
    }
  }

  // Enum validation
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      return {
        valid: false,
        error: `Value must be one of: ${schema.enum.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

function getJsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// Extract JSON from markdown code blocks or raw content
function extractJsonContent(output: string): string {
  // Try to extract from ```json ... ``` code block
  const jsonBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  // Return trimmed output as-is
  return output.trim();
}

// Validate that the entire output is valid JSON (allows ```json ``` wrapper)
function validateIsJson(output: string): { valid: boolean; error?: string } {
  const content = extractJsonContent(output);
  try {
    JSON.parse(content);
    return { valid: true };
  } catch {
    return { valid: false, error: "Output is not valid JSON" };
  }
}

// Validate that the output contains valid JSON somewhere
function validateContainsJson(output: string): { valid: boolean; error?: string } {
  // First try extracting from code blocks
  const jsonBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      JSON.parse(jsonBlockMatch[1].trim());
      return { valid: true };
    } catch {
      // Continue to try other patterns
    }
  }

  // Try to find JSON object or array patterns
  const jsonPatterns = [
    /\{[\s\S]*\}/,  // Object pattern
    /\[[\s\S]*\]/,  // Array pattern
  ];

  for (const pattern of jsonPatterns) {
    const match = output.match(pattern);
    if (match) {
      try {
        JSON.parse(match[0]);
        return { valid: true };
      } catch {
        // Continue to next pattern
      }
    }
  }

  return { valid: false, error: "Output does not contain valid JSON" };
}
