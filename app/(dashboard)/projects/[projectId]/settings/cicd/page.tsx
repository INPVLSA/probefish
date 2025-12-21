"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Settings,
  Users,
  Webhook,
  Database,
  GitBranch,
  Copy,
  Check,
  Shield,
  ExternalLink,
} from "lucide-react";

interface TestSuite {
  id: string;
  name: string;
}

interface ProjectInfo {
  name: string;
}

type CIProvider = "gitlab" | "github" | "jenkins";

export default function CICDSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuite, setSelectedSuite] = useState<string>("all");
  const [provider, setProvider] = useState<CIProvider>("gitlab");
  const [copied, setCopied] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [settingsRes, suitesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/settings`),
        fetch(`/api/projects/${projectId}/test-suites`),
      ]);

      const settingsData = await settingsRes.json();
      const suitesData = await suitesRes.json();

      if (settingsRes.ok) {
        setProject({ name: settingsData.settings.name });
        setUserRole(settingsData.userRole);
      }

      if (suitesRes.ok) {
        setTestSuites(
          suitesData.testSuites.map((s: { _id: string; name: string }) => ({
            id: s._id,
            name: s.name,
          }))
        );
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://your-probefish-instance.com";
  };

  const generateConfig = (): string => {
    const baseUrl = getBaseUrl();
    const suiteId = selectedSuite !== "all" ? selectedSuite : "{SUITE_ID}";
    const suiteName = selectedSuite !== "all"
      ? testSuites.find(s => s.id === selectedSuite)?.name || "Test Suite"
      : "All Suites";

    if (provider === "gitlab") {
      if (selectedSuite === "all") {
        return `# GitLab CI Configuration for ${project?.name || "Probefish"}
# Add PROBEFISH_TOKEN to CI/CD Variables (Settings > CI/CD > Variables)

stages:
  - test

probefish-tests:
  stage: test
  image: curlimages/curl:latest
  variables:
    PROBEFISH_URL: "${baseUrl}"
    PROJECT_ID: "${projectId}"
  script:
    - |
      echo "Exporting test results..."
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/export?format=junit" \\
        -o junit-results.xml
  artifacts:
    when: always
    reports:
      junit: junit-results.xml
`;
      }

      return `# GitLab CI Configuration for ${project?.name || "Probefish"}
# Test Suite: ${suiteName}
# Add PROBEFISH_TOKEN to CI/CD Variables (Settings > CI/CD > Variables)

stages:
  - test

probefish-tests:
  stage: test
  image: curlimages/curl:latest
  variables:
    PROBEFISH_URL: "${baseUrl}"
    PROJECT_ID: "${projectId}"
    SUITE_ID: "${suiteId}"
  script:
    # Run tests
    - |
      echo "Running test suite: ${suiteName}..."
      RESULT=$(curl -s -f -X POST \\
        -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run")

      echo "$RESULT" | head -c 1000

      FAILED=$(echo "$RESULT" | grep -o '"failed":[0-9]*' | grep -o '[0-9]*')
      if [ "$FAILED" -gt 0 ]; then
        echo "Tests failed: $FAILED"
        exit 1
      fi
    # Export results
    - |
      curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \\
        -o junit-results.xml
  artifacts:
    when: always
    reports:
      junit: junit-results.xml
`;
    }

    if (provider === "github") {
      if (selectedSuite === "all") {
        return `# GitHub Actions Configuration for ${project?.name || "Probefish"}
# Add PROBEFISH_TOKEN to Repository Secrets (Settings > Secrets)

name: Probefish Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

env:
  PROBEFISH_URL: "${baseUrl}"
  PROJECT_ID: "${projectId}"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Export Test Results
        run: |
          curl -f -H "Authorization: Bearer \${{ secrets.PROBEFISH_TOKEN }}" \\
            "$PROBEFISH_URL/api/projects/$PROJECT_ID/export?format=junit" \\
            -o junit-results.xml

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: junit-results.xml
`;
      }

      return `# GitHub Actions Configuration for ${project?.name || "Probefish"}
# Test Suite: ${suiteName}
# Add PROBEFISH_TOKEN to Repository Secrets (Settings > Secrets)

name: Probefish Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

env:
  PROBEFISH_URL: "${baseUrl}"
  PROJECT_ID: "${projectId}"
  SUITE_ID: "${suiteId}"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Probefish Tests
        run: |
          echo "Running test suite: ${suiteName}..."
          RESULT=$(curl -s -f -X POST \\
            -H "Authorization: Bearer \${{ secrets.PROBEFISH_TOKEN }}" \\
            "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run")

          echo "$RESULT" | head -c 1000

          FAILED=$(echo "$RESULT" | grep -o '"failed":[0-9]*' | grep -o '[0-9]*')
          if [ "$FAILED" -gt 0 ]; then
            echo "Tests failed: $FAILED"
            exit 1
          fi

      - name: Export Results
        if: always()
        run: |
          curl -f -H "Authorization: Bearer \${{ secrets.PROBEFISH_TOKEN }}" \\
            "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \\
            -o junit-results.xml

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: junit-results.xml
`;
    }

    // Jenkins
    if (selectedSuite === "all") {
      return `// Jenkinsfile for ${project?.name || "Probefish"}
// Add PROBEFISH_TOKEN as a credential in Jenkins

pipeline {
    agent any

    environment {
        PROBEFISH_URL = "${baseUrl}"
        PROJECT_ID = "${projectId}"
        PROBEFISH_TOKEN = credentials('probefish-token')
    }

    stages {
        stage('Export Results') {
            steps {
                sh '''
                    curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
                        "$PROBEFISH_URL/api/projects/$PROJECT_ID/export?format=junit" \\
                        -o junit-results.xml
                '''
            }
            post {
                always {
                    junit 'junit-results.xml'
                }
            }
        }
    }
}
`;
    }

    return `// Jenkinsfile for ${project?.name || "Probefish"}
// Test Suite: ${suiteName}
// Add PROBEFISH_TOKEN as a credential in Jenkins

pipeline {
    agent any

    environment {
        PROBEFISH_URL = "${baseUrl}"
        PROJECT_ID = "${projectId}"
        SUITE_ID = "${suiteId}"
        PROBEFISH_TOKEN = credentials('probefish-token')
    }

    stages {
        stage('Run Tests') {
            steps {
                script {
                    def response = sh(
                        script: '''
                            curl -s -f -X POST \\
                                -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
                                "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/run"
                        ''',
                        returnStdout: true
                    ).trim()

                    echo "Response: \${response.take(1000)}"

                    def failed = (response =~ /"failed":([0-9]+)/)[0][1] as Integer
                    if (failed > 0) {
                        error("Tests failed: \${failed}")
                    }
                }
            }
        }

        stage('Export Results') {
            steps {
                sh '''
                    curl -f -H "Authorization: Bearer $PROBEFISH_TOKEN" \\
                        "$PROBEFISH_URL/api/projects/$PROJECT_ID/test-suites/$SUITE_ID/export?format=junit" \\
                        -o junit-results.xml
                '''
            }
            post {
                always {
                    junit 'junit-results.xml'
                }
            }
        }
    }
}
`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const config = generateConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground">{project?.name}</p>
        </div>
        {userRole && (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {userRole === "full" ? "Full Access" : userRole}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 border-b pb-4">
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings`}>
            <Settings className="h-4 w-4" />
            General
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/members`}>
            <Users className="h-4 w-4" />
            Members
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/webhooks`}>
            <Webhook className="h-4 w-4" />
            Webhooks
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/data`}>
            <Database className="h-4 w-4" />
            Data
          </Link>
        </Button>
        <Button variant="secondary" className="gap-2">
          <GitBranch className="h-4 w-4" />
          CI/CD
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CI/CD Integration</CardTitle>
            <CardDescription>
              Generate configuration for your CI/CD pipeline to run tests automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>CI Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as CIProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gitlab">GitLab CI</SelectItem>
                    <SelectItem value="github">GitHub Actions</SelectItem>
                    <SelectItem value="jenkins">Jenkins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Test Suite</Label>
                <Select value={selectedSuite} onValueChange={setSelectedSuite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suites (export only)</SelectItem>
                    {testSuites.map((suite) => (
                      <SelectItem key={suite.id} value={suite.id}>
                        {suite.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedSuite === "all"
                    ? "Export results for all test suites without running tests"
                    : "Run tests and export results for the selected suite"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Configuration</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(config, "config")}
                >
                  {copied === "config" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-[500px]">
                <code>{config}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Generate Access Token</h4>
              <p className="text-sm text-muted-foreground">
                Create a personal access token with <code className="bg-muted px-1 rounded">exports:read</code>
                {selectedSuite !== "all" && (
                  <> and <code className="bg-muted px-1 rounded">test-runs:execute</code></>
                )} scopes.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/tokens">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Access Tokens
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">2. Add Token to CI/CD</h4>
              <p className="text-sm text-muted-foreground">
                {provider === "gitlab" && (
                  <>Add <code className="bg-muted px-1 rounded">PROBEFISH_TOKEN</code> to your GitLab project&apos;s CI/CD Variables (Settings → CI/CD → Variables). Mark it as &quot;Masked&quot; for security.</>
                )}
                {provider === "github" && (
                  <>Add <code className="bg-muted px-1 rounded">PROBEFISH_TOKEN</code> to your repository&apos;s secrets (Settings → Secrets and variables → Actions).</>
                )}
                {provider === "jenkins" && (
                  <>Add <code className="bg-muted px-1 rounded">probefish-token</code> as a &quot;Secret text&quot; credential in Jenkins (Manage Jenkins → Credentials).</>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">3. Add Configuration File</h4>
              <p className="text-sm text-muted-foreground">
                {provider === "gitlab" && (
                  <>Copy the configuration above to <code className="bg-muted px-1 rounded">.gitlab-ci.yml</code> in your repository root.</>
                )}
                {provider === "github" && (
                  <>Copy the configuration above to <code className="bg-muted px-1 rounded">.github/workflows/probefish.yml</code>.</>
                )}
                {provider === "jenkins" && (
                  <>Copy the configuration above to <code className="bg-muted px-1 rounded">Jenkinsfile</code> in your repository root.</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
