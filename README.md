<h1 align="center"><img src="public/ico.png" alt="Probefish" width="32" height="32" /> Probefish</h1>

A web-based LLM prompt and endpoint testing platform. Organize, version, test, and validate Large Language Model prompts and HTTP endpoints through comprehensive test suites with static validation rules and LLM-based judge evaluation.

## Acknowledgments

This project is developed and maintained with support from [GoMage](https://www.gomage.com/).

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **UI**: Radix UI + Tailwind CSS
- **Authentication**: JWT-based sessions
- **LLM Providers**: OpenAI, Anthropic, Google Gemini

## Features

### Authentication & Organizations

- User registration and login with JWT sessions
- Organization-based multi-tenancy with role-based access control
- Member roles: owner, admin, member, viewer
- Invitation system with expiring tokens
- Super admin functionality for user management

### Project Management

- Create and organize projects with folder hierarchy
- Project visibility (public/private)
- Project-level member management with roles (viewer, editor, admin)
- Projects contain prompts, endpoints, and test suites

### Prompt Management

- Create and version prompts with full version history
- System and user prompts with variable substitution (`{{variable}}` syntax)
- Model configuration per version:
  - Provider: OpenAI, Anthropic, Gemini, custom
  - Models: GPT-4, Claude 3.5, etc.
  - Parameters: temperature, maxTokens, topP, frequencyPenalty, presencePenalty

### Endpoint Management

- Configure HTTP endpoints (GET, POST, PUT, PATCH, DELETE)
- Authentication: None, Bearer token, API key, Basic auth
- Custom headers and body templates with variables
- Response content extraction via JSON path
- Built-in endpoint testing

### Test Suites

- Create test suites targeting prompts or endpoints
- **Test Cases**: Define input variables and expected outputs
- Duplicate test cases for quick variations

### Static Validation Rules

Deterministic checks that run on every response without LLM calls:

| Rule Type | Description |
|-----------|-------------|
| **Contains** | Response must contain specified text |
| **Excludes** | Response must not contain specified text |
| **Min Length** | Response must be at least N characters |
| **Max Length** | Response must not exceed N characters |
| **Regex** | Response must match a regular expression pattern |
| **JSON Schema** | Response must validate against a JSON schema |
| **Max Response Time** | Response must complete within N milliseconds |

Each rule has a **severity level**:
- **Fail**: Test fails if rule is not satisfied
- **Warning**: Test passes but shows a warning

### LLM Judge Evaluation

AI-powered evaluation using an LLM to assess response quality. The judge uses a separate LLM call to evaluate outputs.

#### Scoring Criteria

Define weighted criteria for multi-dimensional scoring:

```
Example:
- Helpfulness (40%) - How helpful is the response?
- Accuracy (30%) - Is the information correct?
- Clarity (30%) - Is it well-organized and clear?
```

The judge scores each criterion 0-100 and computes a weighted average. Criteria weights should sum to 100%.

#### Judge Validation Rules

Pass/fail gates evaluated by the LLM judge:

| Severity | Behavior |
|----------|----------|
| **Fail** | Test fails if the judge determines the rule is not satisfied |
| **Warning** | Test passes but displays a warning |

Example rules:
- "Response must not contain harmful content"
- "Response must include a disclaimer"
- "Response must be in a professional tone"

The judge provides reasoning for each validation decision.

#### Judge Configuration

- **Provider**: OpenAI or Anthropic
- **Model**: Select the model for evaluation (e.g., gpt-4o-mini, claude-3-5-haiku)

### Test Results

- Execute test suites with real LLM/HTTP calls
- Track response times
- View validation results and judge scores
- Test run history with statistics
- Dashboard with pass rates and trends

### Organization Settings

- API key management for LLM providers (encrypted storage)
- Key rotation capability
- Member and invitation management

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance
- API keys for LLM providers (OpenAI/Anthropic)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
MONGODB_URI=mongodb://localhost:27017/probefish
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-byte-encryption-key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

## Project Structure

```
app/
  (auth)/           # Login, register pages
  (dashboard)/      # Main app pages
    projects/       # Project management
    settings/       # Organization settings
  api/              # API routes
components/
  ui/               # Base UI components
  testing/          # Test suite components
  endpoint/         # Endpoint components
  prompt/           # Prompt components
lib/
  db/models/        # Mongoose models
  llm/              # LLM provider integrations
  testing/          # Test execution logic
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
