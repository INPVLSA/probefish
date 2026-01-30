"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteIcon } from "@/components/ui/delete";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Cookie,
  Key,
  Variable,
  Settings2,
  HelpCircle,
} from "lucide-react";

// Session config interface (matching the model)
export interface SessionConfig {
  enabled: boolean;
  persistCookies?: boolean;
  tokenExtraction?: {
    enabled: boolean;
    responsePath: string;
    injection: {
      type: "header" | "body" | "query";
      target: string;
      prefix?: string;
    };
  };
  variableExtraction?: {
    name: string;
    responsePath: string;
  }[];
}

interface SessionConfigEditorProps {
  config: SessionConfig | undefined;
  onChange: (config: SessionConfig | undefined) => void;
}

export function SessionConfigEditor({
  config,
  onChange,
}: SessionConfigEditorProps) {
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);

  // Initialize with default config if undefined
  const sessionConfig: SessionConfig = config || {
    enabled: false,
    persistCookies: false,
    tokenExtraction: {
      enabled: false,
      responsePath: "",
      injection: {
        type: "header",
        target: "",
        prefix: "",
      },
    },
    variableExtraction: [],
  };

  const updateConfig = (updates: Partial<SessionConfig>) => {
    onChange({
      ...sessionConfig,
      ...updates,
    });
  };

  const updateTokenExtraction = (
    updates: Partial<NonNullable<SessionConfig["tokenExtraction"]>>
  ) => {
    updateConfig({
      tokenExtraction: {
        ...sessionConfig.tokenExtraction!,
        ...updates,
      },
    });
  };

  const updateTokenInjection = (
    updates: Partial<NonNullable<SessionConfig["tokenExtraction"]>["injection"]>
  ) => {
    updateConfig({
      tokenExtraction: {
        ...sessionConfig.tokenExtraction!,
        injection: {
          ...sessionConfig.tokenExtraction!.injection,
          ...updates,
        },
      },
    });
  };

  const addVariableExtraction = () => {
    updateConfig({
      variableExtraction: [
        ...(sessionConfig.variableExtraction || []),
        { name: "", responsePath: "" },
      ],
    });
  };

  const updateVariableExtraction = (
    index: number,
    updates: Partial<{ name: string; responsePath: string }>
  ) => {
    const newExtractions = [...(sessionConfig.variableExtraction || [])];
    newExtractions[index] = { ...newExtractions[index], ...updates };
    updateConfig({ variableExtraction: newExtractions });
  };

  const removeVariableExtraction = (index: number) => {
    updateConfig({
      variableExtraction: (sessionConfig.variableExtraction || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const hasTokenConfig =
    sessionConfig.tokenExtraction?.enabled &&
    sessionConfig.tokenExtraction.responsePath;
  const hasVariables = (sessionConfig.variableExtraction?.length || 0) > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Session Management</CardTitle>
            {sessionConfig.enabled && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          <Switch
            checked={sessionConfig.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          />
        </div>
        <CardDescription className="text-xs">
          Maintain state between conversation turns (cookies, tokens, variables)
        </CardDescription>
      </CardHeader>

      {sessionConfig.enabled && (
        <CardContent className="space-y-4">
          {/* Cookie Persistence */}
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <Cookie className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm">Persist Cookies</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically capture and replay cookies between requests
                </p>
              </div>
            </div>
            <Switch
              checked={sessionConfig.persistCookies || false}
              onCheckedChange={(checked) =>
                updateConfig({ persistCookies: checked })
              }
            />
          </div>

          {/* Token Extraction */}
          <Collapsible open={isTokenOpen} onOpenChange={setIsTokenOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-auto py-2"
              >
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <span className="text-sm font-medium">Token Extraction</span>
                    {hasTokenConfig && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Configured
                      </Badge>
                    )}
                  </div>
                </div>
                {isTokenOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 pl-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={sessionConfig.tokenExtraction?.enabled || false}
                  onCheckedChange={(checked) =>
                    updateTokenExtraction({ enabled: checked })
                  }
                />
                <Label className="text-sm">Enable token extraction</Label>
              </div>

              {sessionConfig.tokenExtraction?.enabled && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="token-path" className="text-xs">
                        Response Path
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          JSON path to extract token from response (e.g.,
                          &quot;data.accessToken&quot; or &quot;auth.token&quot;)
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="token-path"
                      value={sessionConfig.tokenExtraction?.responsePath || ""}
                      onChange={(e) =>
                        updateTokenExtraction({ responsePath: e.target.value })
                      }
                      placeholder="e.g., data.accessToken"
                      className="h-8 text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Inject Token Into</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={
                          sessionConfig.tokenExtraction?.injection.type || "header"
                        }
                        onValueChange={(value) =>
                          updateTokenInjection({
                            type: value as "header" | "body" | "query",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="header">Header</SelectItem>
                          <SelectItem value="body">Body</SelectItem>
                          <SelectItem value="query">Query</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={
                          sessionConfig.tokenExtraction?.injection.target || ""
                        }
                        onChange={(e) =>
                          updateTokenInjection({ target: e.target.value })
                        }
                        placeholder={
                          sessionConfig.tokenExtraction?.injection.type === "header"
                            ? "Authorization"
                            : sessionConfig.tokenExtraction?.injection.type ===
                              "body"
                            ? "auth.token"
                            : "token"
                        }
                        className="h-8 text-sm font-mono"
                      />
                      <Input
                        value={
                          sessionConfig.tokenExtraction?.injection.prefix || ""
                        }
                        onChange={(e) =>
                          updateTokenInjection({ prefix: e.target.value })
                        }
                        placeholder="Bearer "
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Type / Target / Prefix (e.g., Header / Authorization / Bearer )
                    </p>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Variable Extraction */}
          <Collapsible open={isVariablesOpen} onOpenChange={setIsVariablesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-auto py-2"
              >
                <div className="flex items-center gap-2">
                  <Variable className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <span className="text-sm font-medium">Variable Extraction</span>
                    {hasVariables && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {sessionConfig.variableExtraction?.length}
                      </Badge>
                    )}
                  </div>
                </div>
                {isVariablesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 pl-6">
              <p className="text-xs text-muted-foreground">
                Extract values from responses to use in subsequent requests
              </p>

              {(sessionConfig.variableExtraction || []).map((extraction, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 group"
                >
                  <Input
                    value={extraction.name}
                    onChange={(e) =>
                      updateVariableExtraction(index, { name: e.target.value })
                    }
                    placeholder="variableName"
                    className="h-8 text-sm font-mono flex-1"
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    value={extraction.responsePath}
                    onChange={(e) =>
                      updateVariableExtraction(index, {
                        responsePath: e.target.value,
                      })
                    }
                    placeholder="response.path"
                    className="h-8 text-sm font-mono flex-1"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DeleteIcon
                        onClick={() => removeVariableExtraction(index)}
                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Remove variable</TooltipContent>
                  </Tooltip>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addVariableExtraction}
                className="w-full h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Variable
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
