"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonEditor } from "./JsonEditor";
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
import { Plus, X, Variable } from "lucide-react";

export interface EndpointConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  auth: {
    type: "none" | "bearer" | "apiKey" | "basic";
    token?: string;
    apiKeyHeader?: string;
    apiKey?: string;
    username?: string;
    password?: string;
  };
  bodyTemplate: string;
  contentType: string;
  responseContentPath: string;
}

interface EndpointFormProps {
  name: string;
  description: string;
  config: EndpointConfig;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onConfigChange: (config: EndpointConfig) => void;
}

// Extract variables from template
function extractVariables(content: string): string[] {
  if (!content) return [];
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  return variables;
}

export function EndpointForm({
  name,
  description,
  config,
  onNameChange,
  onDescriptionChange,
  onConfigChange,
}: EndpointFormProps) {
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");
  const [variables, setVariables] = useState<string[]>([]);

  useEffect(() => {
    setVariables(extractVariables(config.bodyTemplate));
  }, [config.bodyTemplate]);

  const handleAddHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      onConfigChange({
        ...config,
        headers: {
          ...config.headers,
          [newHeaderKey.trim()]: newHeaderValue.trim(),
        },
      });
      setNewHeaderKey("");
      setNewHeaderValue("");
    }
  };

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...config.headers };
    delete newHeaders[key];
    onConfigChange({
      ...config,
      headers: newHeaders,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="My API Endpoint"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="A brief description of what this endpoint does..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Request Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Request Configuration</CardTitle>
          <CardDescription>
            Configure how requests are sent to this endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="w-32">
              <Label>Method</Label>
              <Select
                value={config.method}
                onValueChange={(value) =>
                  onConfigChange({
                    ...config,
                    method: value as EndpointConfig["method"],
                  })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={config.url}
                onChange={(e) =>
                  onConfigChange({ ...config, url: e.target.value })
                }
                placeholder="https://api.example.com/v1/chat"
                className="mt-2"
              />
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <Label>Headers</Label>
            <div className="space-y-2">
              {Object.entries(config.headers).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input value={key} disabled className="w-1/3" />
                  <Input value={value} disabled className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveHeader(key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Header name"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                  className="w-1/3"
                />
                <Input
                  placeholder="Header value"
                  value={newHeaderValue}
                  onChange={(e) => setNewHeaderValue(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddHeader}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Configure authentication for this endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Auth Type</Label>
            <Select
              value={config.auth.type}
              onValueChange={(value) =>
                onConfigChange({
                  ...config,
                  auth: {
                    ...config.auth,
                    type: value as EndpointConfig["auth"]["type"],
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="apiKey">API Key</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.auth.type === "bearer" && (
            <div className="space-y-2">
              <Label htmlFor="token">Bearer Token</Label>
              <Input
                id="token"
                type="password"
                value={config.auth.token || ""}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    auth: { ...config.auth, token: e.target.value },
                  })
                }
                placeholder="Enter your bearer token"
              />
            </div>
          )}

          {config.auth.type === "apiKey" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKeyHeader">Header Name</Label>
                <Input
                  id="apiKeyHeader"
                  value={config.auth.apiKeyHeader || ""}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      auth: { ...config.auth, apiKeyHeader: e.target.value },
                    })
                  }
                  placeholder="X-API-Key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={config.auth.apiKey || ""}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      auth: { ...config.auth, apiKey: e.target.value },
                    })
                  }
                  placeholder="Enter your API key"
                />
              </div>
            </>
          )}

          {config.auth.type === "basic" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={config.auth.username || ""}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      auth: { ...config.auth, username: e.target.value },
                    })
                  }
                  placeholder="Username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={config.auth.password || ""}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      auth: { ...config.auth, password: e.target.value },
                    })
                  }
                  placeholder="Password"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Request Body */}
      {["POST", "PUT", "PATCH"].includes(config.method) && (
        <Card>
          <CardHeader>
            <CardTitle>Request Body</CardTitle>
            <CardDescription>
              Define the JSON body template. Use {"{{variable}}"} syntax for
              dynamic values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contentType">Content Type</Label>
              <Input
                id="contentType"
                value={config.contentType}
                onChange={(e) =>
                  onConfigChange({ ...config, contentType: e.target.value })
                }
                placeholder="application/json"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyTemplate">Body Template</Label>
              <JsonEditor
                value={config.bodyTemplate}
                onChange={(value) =>
                  onConfigChange({ ...config, bodyTemplate: value })
                }
                height="250px"
              />
            </div>
            {variables.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Variable className="h-4 w-4" />
                  Detected Variables
                </Label>
                <div className="flex flex-wrap gap-2">
                  {variables.map((v) => (
                    <Badge key={v} variant="secondary">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Response Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Response Configuration</CardTitle>
          <CardDescription>
            Configure how to extract content from the response
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="responseContentPath">Response Content Path</Label>
            <Input
              id="responseContentPath"
              value={config.responseContentPath}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  responseContentPath: e.target.value,
                })
              }
              placeholder="data.choices[0].message.content"
            />
            <p className="text-sm text-muted-foreground">
              JSONPath to extract the main content from the response. Leave
              empty to use the full response.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
