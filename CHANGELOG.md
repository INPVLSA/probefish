### v0.9.1
- 
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
