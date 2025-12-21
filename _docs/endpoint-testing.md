# Endpoint Testing Guide

Probefish allows you to test HTTP endpoints alongside LLM prompts. This guide covers how to configure and test endpoints.

## Creating an Endpoint

1. Navigate to your project
2. Click the **Endpoints** tab
3. Click **New Endpoint**
4. Configure the endpoint settings

## Endpoint Configuration

### Basic Settings

| Field | Description |
|-------|-------------|
| **Name** | Descriptive name for the endpoint |
| **URL** | The endpoint URL (supports variables: `{{baseUrl}}/api/users`) |
| **Method** | HTTP method: GET, POST, PUT, PATCH, DELETE |

### Authentication

Select the authentication method:

| Type | Configuration |
|------|---------------|
| **None** | No authentication |
| **Bearer Token** | Token value (supports variables) |
| **API Key** | Header name and key value |
| **Basic Auth** | Username and password |

### Headers

Add custom headers as key-value pairs:

```
Content-Type: application/json
X-Custom-Header: {{customValue}}
```

Headers support variable substitution using `{{variableName}}` syntax.

### Request Body

For POST, PUT, and PATCH requests, define the body template:

```json
{
  "name": "{{userName}}",
  "email": "{{userEmail}}",
  "role": "user"
}
```

Variables are replaced with values from test cases at runtime.

### Response Extraction

Extract specific values from JSON responses using JSON path:

| Field | Description |
|-------|-------------|
| **Content Path** | JSON path to extract (e.g., `data.result`, `items[0].name`) |

If not specified, the entire response body is used for validation.

## Testing an Endpoint

### Quick Test

1. Open the endpoint
2. Click **Test** in the header
3. Fill in any required variables
4. Click **Send Request**
5. View the response, status code, and timing

### Creating a Test Suite

1. Go to **Test Suites** tab
2. Click **New Test Suite**
3. Select **Endpoint** as target type
4. Choose your endpoint
5. Add test cases with variable values

## Test Case Structure

Each test case defines:

| Field | Description |
|-------|-------------|
| **Name** | Test case identifier |
| **Variables** | Key-value pairs for URL, headers, and body substitution |
| **Expected Output** | (Optional) Expected response content |

### Example Test Case

For an endpoint `POST /api/assistant/query` with body template:
```json
{
  "query": "{{query}}",
  "user_id": "{{userId}}"
}
```

Test case variables:
```
query: How do I reset my password?
userId: test-user-123
```

## Validation Rules

Apply validation rules to endpoint responses:

### Static Rules

| Rule | Description | Example |
|------|-------------|---------|
| **Contains** | Response contains text | `"success": true` |
| **Excludes** | Response does not contain text | `error` |
| **Min Length** | Minimum response length | `100` |
| **Max Length** | Maximum response length | `5000` |
| **Regex** | Match regular expression | `"id":\s*"\w+"` |
| **JSON Schema** | Validate against JSON schema | See below |
| **Max Response Time** | Response time limit (ms) | `2000` |

### JSON Schema Validation

Validate response structure:

```json
{
  "type": "object",
  "required": ["id", "name", "email"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "email": { "type": "string", "format": "email" }
  }
}
```

### LLM Judge

Enable LLM-based evaluation for semantic validation:

- Define scoring criteria (e.g., "Data completeness", "Response relevance")
- Add judge validation rules (e.g., "Response must contain valid user data")
- Set minimum score threshold

## Running Tests

1. Open the test suite
2. Click **Run Tests**
3. View results for each test case:
   - Response content
   - Response time
   - Validation results
   - Judge scores (if enabled)

## Example: Testing an AI Assistant Endpoint

This example shows how to test a custom AI assistant (e.g., a RAG-based support bot, knowledge base assistant, or AI agent).

### 1. Create Endpoint

```
Name: Support Assistant
URL: https://api.example.com/assistant/query
Method: POST
Auth: API Key - X-API-Key: {{apiKey}}
Headers:
  Content-Type: application/json
```

Body template:
```json
{
  "query": "{{query}}",
  "conversation_id": "{{conversationId}}",
  "user_id": "{{userId}}"
}
```

Response content path: `answer`

### 2. Create Test Suite

Target: "Support Assistant" endpoint

### 3. Add Test Cases

**Test Case 1: Product Information Query**
```
Variables:
  apiKey: your-api-key
  query: What are the pricing plans available?
  conversationId: test-conv-001
  userId: test-user

Expected: Information about pricing tiers
```

**Test Case 2: Technical Support Query**
```
Variables:
  apiKey: your-api-key
  query: How do I reset my password?
  conversationId: test-conv-002
  userId: test-user

Expected: Step-by-step password reset instructions
```

**Test Case 3: Out-of-Scope Query**
```
Variables:
  apiKey: your-api-key
  query: What is the weather in Tokyo?
  conversationId: test-conv-003
  userId: test-user

Expected: Polite deflection to relevant topics
```

**Test Case 4: Follow-up Query**
```
Variables:
  apiKey: your-api-key
  query: Can you tell me more about the enterprise plan?
  conversationId: test-conv-001
  userId: test-user

Expected: Detailed enterprise plan information with context from previous query
```

### 4. Add Validation Rules

**Static Rules:**
- Excludes: `I don't know` (severity: warning)
- Excludes: `error` (severity: fail)
- Min Length: `50` (severity: warning)
- Max Response Time: `3000` (severity: warning)

**LLM Judge Configuration:**
- Enable LLM Judge
- Provider: OpenAI, Model: gpt-4o-mini

**Scoring Criteria:**
- Relevance (40%): Does the answer address the user's query?
- Accuracy (30%): Is the information factually correct?
- Helpfulness (30%): Does it provide actionable guidance?

**Judge Validation Rules:**
- "Response must directly answer the user's question" (severity: fail)
- "Response must not hallucinate product features" (severity: fail)
- "Response should maintain professional tone" (severity: warning)

### 5. Run and Review

Execute the test suite and review:
- Assistant responses to each query
- Response latency
- Static validation results
- Judge scores and reasoning
- Context handling in follow-up queries

## Tips

1. **Use variables for environment-specific values** - Base URLs, API keys, and test data should be variables
2. **Test error cases** - Include test cases for invalid inputs, missing auth, etc.
3. **Set appropriate timeouts** - Use Max Response Time to catch performance regressions
4. **Use JSON Schema for structure validation** - Ensures API contract compliance
5. **Combine with webhooks** - Get notified when endpoint tests fail
