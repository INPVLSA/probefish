# v1.1.0 (Cichlid)
- Added multi-turn conversations support
- Added human-readable identifiers (slugs) for CLI and UI
- Added related endpoint or prompt link to test suite
- Added full payload preview for endpoint testing test cases
- Added project folders
- Improved UI (Added skeleton preloaders for UI components)

### v1.0.2
- Fixed issue with Cloud licensing
- Fixed issues with versioning

### v1.0.1
- Doc changes, version fixes
- Fixed vulnerable packages

# v1.0.0 (Marlin)
- Going SaaS, plans and license implementation. Self-hosted free forever.
- Added validation rules per test case
- Added Server-Sent Events (SSE) streaming that sends results as each test case completes, with heartbeats to keep the connection alive
- Added URL hash based tab persistence for testing suite, project
- Added auto JSON support for fields in "Edit Test Case" modal
- Added ability to duplicate static validation rule (for ones makes sense to duplicate)
- Added full support of SMTP. Removed Resend.
- Added Magic Links support
- Fixed newly added test case has no selection checkbox until suite saved and page reloaded
- Minor UI improvements

### v0.9.2
- Added healthcheck for containers
- Added `container_name` to compose configuration

### v0.9.1
- SSE transport support for remote MCP access
- Fixed AI Judge Score Threshold Not Applied
- Fixed history persistence bug
- License updated to ELv2

# v0.9.0 (Swordfish)

- CLI tooling - run tests, manage test cases from terminal
- MCP server - integrate with Claude Code and AI assistants
- Test case CRUD API endpoints
- Token auth support for projects endpoint
- Improved auth security - validate before DB connection

# v0.8.0 (Blobfish)

- Grok (xAI) provider support - Grok 3, Grok 2 and variants
- DeepSeek provider support - DeepSeek Chat and DeepSeek Reasoner
- Run single test case - click Play button on any test case row to run it individually
- Run selected test cases - use checkboxes to select multiple test cases and run them together
- Drag-to-reorder test cases - drag the grip handle to reorder test cases in a suite
- Suspend/resume test cases - toggle individual test cases to skip them during runs without deleting
- Fixed issue with ignoring score threshold
- LLM Judge now supports all providers (Grok, DeepSeek added)
- UI improvements
- JSON syntax highlight

### v0.7.1

- Prompt preview in test suite
- "Latest" prompt version option for test suites
- Change prompt version in test suite settings
- "Is JSON" and "Contains JSON" validation rules
- Documentation: Added ENCRYPTION_KEY generation instructions to README and Dockerfile
- Improved error messages for network failures (now shows root cause like DNS/connection errors)
- Run tests multiple times (N iterations) for consistency testing
- UI improvements

# v0.7.0 (Mahi-mahi)

- Open Source now.
