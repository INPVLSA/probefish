"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Play, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TestResult {
  success: boolean;
  error?: string;
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    extractedContent: unknown;
  };
  timing?: {
    responseTime: number;
  };
}

interface EndpointTesterProps {
  projectId: string;
  endpointId: string;
  variables: string[];
}

export function EndpointTester({
  projectId,
  endpointId,
  variables,
}: EndpointTesterProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {}
  );
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/endpoints/${endpointId}/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ variables: variableValues }),
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Test Endpoint
        </CardTitle>
        <CardDescription>
          Fill in the variable values and test the endpoint
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variables.length > 0 ? (
          <div className="space-y-3">
            <Label>Variables</Label>
            {variables.map((varName) => (
              <div key={varName} className="space-y-1">
                <Label htmlFor={varName} className="text-sm text-muted-foreground">
                  {`{{${varName}}}`}
                </Label>
                <Input
                  id={varName}
                  value={variableValues[varName] || ""}
                  onChange={(e) =>
                    setVariableValues((prev) => ({
                      ...prev,
                      [varName]: e.target.value,
                    }))
                  }
                  placeholder={`Enter value for ${varName}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No variables detected in the request body template.
          </p>
        )}

        <Button
          onClick={handleTest}
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Send Test Request
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4 pt-4 border-t">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {result.success ? "Success" : "Failed"}
                </span>
              </div>
              {result.timing && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {result.timing.responseTime}ms
                </Badge>
              )}
            </div>

            {/* Error */}
            {result.error && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 rounded-lg text-sm">
                {result.error}
              </div>
            )}

            {/* Response Status */}
            {result.response && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      result.response.status >= 200 &&
                      result.response.status < 300
                        ? "default"
                        : "destructive"
                    }
                  >
                    {result.response.status} {result.response.statusText}
                  </Badge>
                </div>

                {/* Extracted Content */}
                {result.response.extractedContent !== undefined && (
                  <div className="space-y-2">
                    <Label className="text-sm">Extracted Content</Label>
                    <div className="bg-muted rounded-lg p-3 max-h-40 overflow-auto">
                      <pre className="text-sm whitespace-pre-wrap break-words">
                        {typeof result.response.extractedContent === "string"
                          ? result.response.extractedContent
                          : JSON.stringify(
                              result.response.extractedContent,
                              null,
                              2
                            )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Full Response */}
                <div className="space-y-2">
                  <Label className="text-sm">Full Response Body</Label>
                  <div className="bg-muted rounded-lg p-3 max-h-60 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {typeof result.response.body === "string"
                        ? result.response.body
                        : JSON.stringify(result.response.body, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Request Details */}
            {result.request && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View Request Details
                </summary>
                <div className="mt-2 bg-muted rounded-lg p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(result.request, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
