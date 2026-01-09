# Probefish CLI

Command-line interface for running tests, managing test cases, and integrating with CI/CD pipelines.

## Installation

```bash
npm install -g probefish
```

Or run directly with npx:

```bash
npx probefish --help
```

## Setup

### 1. Get an API Token

Generate a Personal Access Token from the web UI:
1. Go to Settings → Access Tokens
2. Create a token with required scopes
3. Copy the token (starts with `pf_`)

### 2. Configure the CLI

```bash
# Set your token
probefish auth token <your-token>

# Set API URL (required for self-hosted)
probefish config set api.baseUrl https://your-instance.com/api
```

### 3. Verify Setup

```bash
probefish auth status
```

## Commands

### auth - Authentication

```bash
probefish auth token <token>   # Set API token
probefish auth logout          # Clear stored token
probefish auth status          # Check authentication status
```

### config - Configuration

```bash
probefish config set <key> <value>   # Set config value
probefish config get <key>           # Get config value
probefish config list                # List all config
```

Config keys:
- `api.baseUrl` - API endpoint URL
- `output.format` - Default output format (table/json)
- `output.color` - Enable colors (true/false)

### list - List Resources

```bash
# List projects
probefish list projects

# List test suites in a project
probefish list suites -p <project-id>

# List test runs for a suite
probefish list runs -p <project-id> -s <suite-id>

# List test cases in a suite
probefish list test-cases -p <project-id> -s <suite-id>
```

Options:
- `-p, --project <id>` - Project ID
- `-s, --suite <id>` - Test suite ID
- `--format <format>` - Output format (table/json)
- `--limit <n>` - Limit results

### run - Execute Tests

```bash
probefish run <suite-id> -p <project-id>
```

Options:
- `-p, --project <id>` - Project ID (required)
- `-n, --iterations <n>` - Run N times (default: 1)
- `-m, --model <model>` - Override model (e.g., `openai:gpt-4o`)
- `--note <note>` - Add note to test run
- `-o, --output <format>` - Output format (table/json/junit)
- `--output-file <path>` - Write results to file
- `-q, --quiet` - Minimal output

Exit codes:
- `0` - All tests passed
- `1` - Some tests failed
- `2` - Error (auth, network, etc.)

### export - Export Data

```bash
probefish export <suite-id> -p <project-id>
```

Options:
- `-p, --project <id>` - Project ID (required)
- `-f, --format <format>` - Export format (json/junit/csv)
- `-o, --output <path>` - Output file path

### add - Create Resources

```bash
# Add a test case
probefish add test-case -p <project-id> -s <suite-id> \
  -n "Test name" \
  -i '{"variable": "value"}' \
  -e "Expected output"
```

Options:
- `-p, --project <id>` - Project ID (required)
- `-s, --suite <id>` - Test suite ID (required)
- `-n, --name <name>` - Test case name (required)
- `-i, --inputs <json>` - Input variables as JSON
- `-e, --expected <output>` - Expected output
- `--notes <notes>` - Notes
- `-t, --tags <tags>` - Comma-separated tags
- `-f, --file <path>` - Read from JSON file
- `--stdin` - Read from stdin

### update - Update Resources

```bash
# Update a test case
probefish update test-case <test-case-id> -p <project-id> -s <suite-id> \
  -n "New name" \
  --enable
```

Options:
- `-p, --project <id>` - Project ID (required)
- `-s, --suite <id>` - Test suite ID (required)
- `-n, --name <name>` - New name
- `-i, --inputs <json>` - New inputs
- `-e, --expected <output>` - New expected output
- `--notes <notes>` - New notes
- `-t, --tags <tags>` - New tags
- `--enable` - Enable test case
- `--disable` - Disable test case
- `-f, --file <path>` - Read updates from JSON file
- `--stdin` - Read updates from stdin

### delete - Delete Resources

```bash
# Delete a test case
probefish delete test-case <test-case-id> -p <project-id> -s <suite-id>
```

Options:
- `-p, --project <id>` - Project ID (required)
- `-s, --suite <id>` - Test suite ID (required)
- `-y, --yes` - Skip confirmation

### mcp - MCP Server

```bash
probefish mcp serve              # Start MCP server (stdio mode)
probefish mcp serve --http       # Start HTTP server for remote access
probefish mcp serve --http -p 8080  # Custom port
probefish mcp serve --http --no-auth  # Disable auth (not recommended)
probefish mcp info               # Show configuration info
```

Options:
- `--http` - Run as HTTP server instead of stdio
- `-p, --port <number>` - HTTP server port (default: 3001)
- `--no-auth` - Disable authentication for HTTP mode (not recommended)

## CI/CD Integration

### GitHub Actions

```yaml
name: LLM Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g probefish
      - run: probefish auth token ${{ secrets.PROBEFISH_TOKEN }}
      - run: probefish config set api.baseUrl ${{ vars.PROBEFISH_URL }}
      - run: probefish run ${{ vars.TEST_SUITE_ID }} -p ${{ vars.PROJECT_ID }} -o junit --output-file results.xml
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Probefish Tests
          path: results.xml
          reporter: java-junit
```

### GitLab CI

```yaml
llm-tests:
  image: node:20
  script:
    - npm install -g probefish
    - probefish auth token $PROBEFISH_TOKEN
    - probefish config set api.baseUrl $PROBEFISH_URL
    - probefish run $TEST_SUITE_ID -p $PROJECT_ID -o junit --output-file results.xml
  artifacts:
    reports:
      junit: results.xml
```

### Environment Variables

The CLI supports environment variables as an alternative to config:

- `PROBEFISH_TOKEN` - API token
- `PROBEFISH_BASE_URL` - API base URL

## MCP Server Integration

The MCP (Model Context Protocol) server allows AI assistants to interact with Probefish directly. Your AI assistant can run tests, manage test cases, and analyze results.

### What is MCP?

MCP is an open protocol developed by Anthropic that enables AI assistants to connect to external tools and data sources. With Probefish MCP, you can ask your AI assistant to:

- "Run the test suite for my checkout prompt"
- "Add a test case for edge case handling"
- "Show me the results from the last test run"
- "Export test results as JUnit XML"

### Prerequisites

Before setting up MCP, ensure the CLI is configured:

```bash
# Install globally
npm install -g probefish

# Configure authentication
probefish auth token <your-token>
probefish config set api.baseUrl https://your-instance.com/api

# Verify setup
probefish mcp info
```

### Setup with Claude Code

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "probefish": {
      "command": "probefish",
      "args": ["mcp", "serve"]
    }
  }
}
```

Or add to your global Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "probefish": {
      "command": "probefish",
      "args": ["mcp", "serve"]
    }
  }
}
```

Restart Claude Code after adding the configuration.

### Setup with Cursor

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" or navigate to Features → MCP Servers
3. Add a new MCP server with:
   - **Name**: `probefish`
   - **Command**: `probefish`
   - **Arguments**: `mcp serve`

Or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "probefish": {
      "command": "probefish",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Setup with Other MCP Clients

For any MCP-compatible client, use stdio transport:

```json
{
  "mcpServers": {
    "probefish": {
      "command": "probefish",
      "args": ["mcp", "serve"],
      "transport": "stdio"
    }
  }
}
```

If probefish is not installed globally, use npx:

```json
{
  "mcpServers": {
    "probefish": {
      "command": "npx",
      "args": ["probefish", "mcp", "serve"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `probefish_list_projects` | List all accessible projects |
| `probefish_list_suites` | List test suites in a project |
| `probefish_get_suite` | Get test suite details with test cases |
| `probefish_list_test_cases` | List all test cases in a suite |
| `probefish_run_suite` | Run a test suite and get results |
| `probefish_list_runs` | List historical test runs |
| `probefish_export` | Export test data (json/junit/csv) |
| `probefish_add_test_case` | Create a new test case |
| `probefish_update_test_case` | Modify an existing test case |
| `probefish_delete_test_case` | Remove a test case |

### Example Prompts

Once configured, you can use natural language:

```
"List my Probefish projects"

"Run the test suite abc123 in project xyz789"

"Add a test case to suite abc123 with name 'Empty input handling'
 and input variable query set to empty string"

"Show me the last 5 test runs for suite abc123"

"Export the test suite as JUnit XML"
```

### Troubleshooting MCP

**Server not connecting:**
```bash
# Check CLI is working
probefish mcp info

# Verify auth
probefish auth status
```

**Permission errors:**
Ensure your token has the required scopes:
- `projects:read` - List projects
- `test-suites:read` - List/view suites and test cases
- `test-suites:write` - Create/update/delete test cases
- `test-runs:execute` - Run test suites
- `exports:read` - Export data

## Remote MCP Access (HTTP Mode)

For remote access or web-based MCP clients, you can run the MCP server in HTTP mode using the Streamable HTTP transport.

### Starting the HTTP Server

```bash
# Start on default port 3001
probefish mcp serve --http

# Start on custom port
probefish mcp serve --http --port 8080
```

The server outputs connection info:
```
Probefish MCP Server (HTTP mode)
Endpoint: http://localhost:3001
Auth: Bearer token validated against API
```

### Authentication

By default, HTTP mode validates Bearer tokens against the Probefish API. Use any valid Probefish API token:

```
Authorization: Bearer pf_your_token_here
```

Tokens are validated by making a request to the Probefish API and cached for 5 minutes for performance.

**Disabling Authentication (Not Recommended):**

For local development or trusted networks only, you can disable authentication:

```bash
probefish mcp serve --http --no-auth
```

When disabled, the server accepts all requests without authentication.

### Connecting from Claude Code

Use the `claude mcp add` command to connect to the remote HTTP server:

```bash
claude mcp add --transport http probefish http://your-server:3001 \
  --header "Authorization: Bearer <your-probefish-token>"
```

Or use the interactive menu:
```bash
claude mcp add
# Select "http" transport, enter URL and headers
```

### Connecting Other MCP Clients

For other MCP clients that support Streamable HTTP transport, add to your config:

```json
{
  "mcpServers": {
    "probefish": {
      "type": "streamableHttp",
      "url": "http://your-server:3001",
      "headers": {
        "Authorization": "Bearer <your-probefish-token>"
      }
    }
  }
}
```

### Testing the Connection

```bash
# List available tools
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Call a tool
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"probefish_list_projects","arguments":{}},"id":2}'
```

### Exposing to Remote Clients

The HTTP server binds to localhost by default. For remote access:

**Option 1: Reverse Proxy (Recommended for production)**

Use nginx, Caddy, or similar to proxy requests with TLS:

```nginx
# nginx example
location /mcp {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

**Option 2: SSH Tunnel (Development/testing)**

From your client machine:
```bash
ssh -L 3001:localhost:3001 user@your-server.com
```

Then connect to `http://localhost:3001` locally.

### HTTP Mode vs Stdio Mode

| Aspect | Stdio Mode | HTTP Mode |
|--------|------------|-----------|
| Use case | Local AI assistants | Remote clients, web apps |
| Connection | Process pipes | HTTP/SSE |
| Auth | Uses CLI config | Bearer token per request |
| Concurrency | Single client | Multiple clients |
| Command | `probefish mcp serve` | `probefish mcp serve --http` |

## Output Formats

### Table (default for TTY)

Human-readable tabular output with colors.

### JSON (default for pipes)

Machine-readable JSON output. Automatically used when piping to other commands.

### JUnit XML

For CI/CD integration. Use `--output junit` or `-o junit`.

## Examples

```bash
# List all projects
probefish list projects

# Run a test suite
probefish run 507f1f77bcf86cd799439011 -p 507f1f77bcf86cd799439012

# Run with model override
probefish run <suite-id> -p <project-id> -m openai:gpt-4o

# Export as JUnit XML
probefish export <suite-id> -p <project-id> -f junit -o results.xml

# Add test case from stdin
echo '{"name": "Test", "inputs": {"query": "Hello"}}' | probefish add test-case -p <project-id> -s <suite-id> --stdin

# Batch add test cases from file
probefish add test-case -p <project-id> -s <suite-id> -f test-cases.json
```
