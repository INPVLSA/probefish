# GitLab CI Integration

This guide explains how to integrate Probefish with GitLab CI to automatically run tests and export results as part of your pipeline.

## Quick Start

1. Go to your project in Probefish
2. Click the **GitBranch icon** in the header or navigate to **Settings → CI/CD**
3. Select **GitLab CI** as the provider
4. Select a test suite (or "All Suites" for export only)
5. Copy the generated configuration

## Setup Steps

### 1. Generate Access Token

1. Go to **Settings → Access Tokens** in Probefish
2. Click **Generate Token**
3. Enter a name (e.g., "GitLab CI")
4. Select scopes:
   - `exports:read` - Required for exporting results
   - `test-runs:execute` - Required if running tests (not just exporting)
5. Choose expiration period
6. Click **Generate Token**
7. Copy the token immediately (it won't be shown again)

### 2. Add Token to GitLab

1. Go to your GitLab project
2. Navigate to **Settings → CI/CD → Variables**
3. Click **Add variable**
4. Set:
   - Key: `PROBEFISH_TOKEN`
   - Value: Your token (e.g., `pf_abc123...`)
   - Type: Variable
   - Flags: Check **Mask variable** for security
5. Click **Add variable**

### 3. Add Configuration File

Create `.gitlab-ci.yml` in your repository root with the generated configuration.

## Configuration Examples

### Export Only (All Test Suites)

Export the latest test results without running new tests:

```yaml
stages:
  - test

probefish-export:
  stage: test
  image: curlimages/curl:latest
  variables:
    PROBEFISH_URL: "https://your-probefish-instance.com"
    PROJECT_ID: "your-project-id"
  script:
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/export?format=junit" \
        -o junit-results.xml
  artifacts:
    when: always
    reports:
      junit: junit-results.xml
```

### Run Tests and Export Results

Run a specific test suite and export results:

```yaml
stages:
  - test

probefish-tests:
  stage: test
  image: curlimages/curl:latest
  variables:
    PROBEFISH_URL: "https://your-probefish-instance.com"
    PROJECT_ID: "your-project-id"
    SUITE_ID: "your-suite-id"
  script:
    # Run tests
    - |
      echo "Running tests..."
      RESULT=$(curl -s -f -X POST \
        -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run")

      echo "$RESULT" | head -c 1000

      FAILED=$(echo "$RESULT" | grep -o '"failed":[0-9]*' | grep -o '[0-9]*')
      if [ "$FAILED" -gt 0 ]; then
        echo "Tests failed: $FAILED"
        exit 1
      fi
    # Export results
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \
        -o junit-results.xml
  artifacts:
    when: always
    reports:
      junit: junit-results.xml
```

### Run Multiple Test Suites

```yaml
stages:
  - test

.probefish-template: &probefish-template
  stage: test
  image: curlimages/curl:latest
  variables:
    PROBEFISH_URL: "https://your-probefish-instance.com"
    PROJECT_ID: "your-project-id"
  artifacts:
    when: always
    reports:
      junit: junit-results.xml

api-tests:
  <<: *probefish-template
  variables:
    SUITE_ID: "api-suite-id"
  script:
    - |
      curl -s -f -X POST \
        -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run"
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \
        -o junit-results.xml

prompt-tests:
  <<: *probefish-template
  variables:
    SUITE_ID: "prompt-suite-id"
  script:
    - |
      curl -s -f -X POST \
        -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run"
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \
        -o junit-results.xml
```

### Scheduled Pipeline

Run tests on a schedule (e.g., nightly):

```yaml
probefish-nightly:
  stage: test
  image: curlimages/curl:latest
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  variables:
    PROBEFISH_URL: "https://your-probefish-instance.com"
    PROJECT_ID: "your-project-id"
    SUITE_ID: "your-suite-id"
  script:
    - |
      curl -s -f -X POST \
        -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run"
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \
        -o junit-results.xml
  artifacts:
    when: always
    reports:
      junit: junit-results.xml
```

To set up the schedule:
1. Go to **CI/CD → Schedules** in GitLab
2. Click **New schedule**
3. Set interval (e.g., `0 2 * * *` for 2 AM daily)
4. Save

## Viewing Results in GitLab

GitLab automatically parses JUnit XML reports and displays:

- Test summary in merge request widgets
- Detailed test results in the **Tests** tab of pipeline pages
- Test trends over time
- Failed test details with error messages

## Troubleshooting

### Token Authentication Failed

- Verify token is correctly set in CI/CD variables
- Check token hasn't expired
- Ensure token has required scopes (`exports:read`, `test-runs:execute`)

### Connection Refused

- Verify `PROBEFISH_URL` is accessible from GitLab runners
- Check firewall rules if using self-hosted GitLab

### Tests Timeout

LLM-based tests may take longer. Increase the job timeout:

```yaml
probefish-tests:
  timeout: 30 minutes
  # ... rest of config
```

### Empty Results

- Ensure the test suite has test cases
- Check that tests have been run at least once
- Verify the suite ID is correct

## Related Documentation

- [Endpoint Testing Guide](./endpoint-testing.md) - How to test endpoints
