"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Save,
  GitBranch,
  Clock,
  User,
  ChevronDown,
} from "lucide-react";
import { PromptEditor } from "@/components/prompt/PromptEditor";
import { ModelConfigEditor, ModelConfig } from "@/components/prompt/ModelConfigEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface PromptVersion {
  version: number;
  content: string;
  systemPrompt?: string;
  variables: string[];
  modelConfig?: ModelConfig;
  createdBy: { name: string; email: string };
  createdAt: string;
  note?: string;
}

interface Prompt {
  _id: string;
  name: string;
  description?: string;
  versions: PromptVersion[];
  currentVersion: number;
  tags: string[];
}

export default function PromptDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; promptId: string }>;
}) {
  const { projectId, promptId } = use(params);
  const router = useRouter();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [systemVariables, setSystemVariables] = useState<string[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/prompts/${promptId}`
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch prompt");
          return;
        }

        setPrompt(data.prompt);
        setName(data.prompt.name);
        setDescription(data.prompt.description || "");

        // Get current version
        const currentVer = data.prompt.versions.find(
          (v: PromptVersion) => v.version === data.prompt.currentVersion
        );
        if (currentVer) {
          setSelectedVersion(currentVer);
          setContent(currentVer.content);
          setSystemPrompt(currentVer.systemPrompt || "");
          setVariables(currentVer.variables);
          if (currentVer.modelConfig) {
            setModelConfig({
              provider: currentVer.modelConfig.provider || "openai",
              model: currentVer.modelConfig.model || "gpt-4o-mini",
              temperature: currentVer.modelConfig.temperature ?? 0.7,
              maxTokens: currentVer.modelConfig.maxTokens,
              topP: currentVer.modelConfig.topP,
              frequencyPenalty: currentVer.modelConfig.frequencyPenalty,
              presencePenalty: currentVer.modelConfig.presencePenalty,
            });
          }
        }
      } catch {
        setError("Failed to fetch prompt");
      } finally {
        setLoading(false);
      }
    };

    fetchPrompt();
  }, [projectId, promptId]);

  const handleVersionSelect = (version: PromptVersion) => {
    setSelectedVersion(version);
    setContent(version.content);
    setSystemPrompt(version.systemPrompt || "");
    setVariables(version.variables);
    if (version.modelConfig) {
      setModelConfig({
        provider: version.modelConfig.provider || "openai",
        model: version.modelConfig.model || "gpt-4o-mini",
        temperature: version.modelConfig.temperature ?? 0.7,
        maxTokens: version.modelConfig.maxTokens,
        topP: version.modelConfig.topP,
        frequencyPenalty: version.modelConfig.frequencyPenalty,
        presencePenalty: version.modelConfig.presencePenalty,
      });
    }
    setHasChanges(true);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleSaveNewVersion = async () => {
    if (!content.trim()) {
      setError("Prompt content is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Save new version
      const response = await fetch(
        `/api/projects/${projectId}/prompts/${promptId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            systemPrompt: systemPrompt.trim() || undefined,
            modelConfig,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save prompt");
        return;
      }

      setPrompt(data.prompt);
      const newVersion = data.prompt.versions.find(
        (v: PromptVersion) => v.version === data.prompt.currentVersion
      );
      if (newVersion) {
        setSelectedVersion(newVersion);
        setVariables(newVersion.variables);
      }
      setHasChanges(false);
      toast.success(`Version ${data.prompt.currentVersion} saved!`);

      // Update metadata if changed
      if (name !== prompt?.name || description !== (prompt?.description || "")) {
        await fetch(`/api/projects/${projectId}/prompts/${promptId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
          }),
        });
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading prompt...</div>
      </div>
    );
  }

  if (error && !prompt) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{prompt?.name}</h1>
            <Badge variant="outline" className="gap-1">
              <GitBranch className="h-3 w-3" />
              v{prompt?.currentVersion}
            </Badge>
          </div>
          {prompt?.description && (
            <p className="text-muted-foreground">{prompt.description}</p>
          )}
        </div>
        <Button onClick={handleSaveNewVersion} disabled={saving || !hasChanges}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : hasChanges ? "Save New Version" : "Saved"}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Prompt Content</CardTitle>
                  <CardDescription>
                    Edit your prompt. Changes will be saved as a new version.
                  </CardDescription>
                </div>
                {prompt && prompt.versions.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <GitBranch className="mr-2 h-4 w-4" />
                        Version {selectedVersion?.version}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {prompt.versions
                        .slice()
                        .reverse()
                        .map((v) => (
                          <DropdownMenuItem
                            key={v.version}
                            onClick={() => handleVersionSelect(v)}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>Version {v.version}</span>
                              {v.version === prompt.currentVersion && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="user" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="user" className="gap-2">
                    User Prompt
                    {content.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {content.length.toLocaleString()}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="system" className="gap-2">
                    System Prompt
                    {systemPrompt.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {systemPrompt.length.toLocaleString()}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="user" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    The message sent to the AI. Use {"{{variables}}"} for dynamic inputs.
                  </p>
                  <PromptEditor
                    value={content}
                    onChange={handleContentChange}
                    variables={variables}
                    onVariablesChange={setVariables}
                    height="400px"
                  />
                </TabsContent>
                <TabsContent value="system" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sets the AI&apos;s behavior, persona, and constraints. Defines how the AI should respond.
                  </p>
                  <PromptEditor
                    value={systemPrompt}
                    onChange={(value) => {
                      setSystemPrompt(value);
                      setHasChanges(true);
                    }}
                    variables={systemVariables}
                    onVariablesChange={setSystemVariables}
                    height="400px"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ModelConfigEditor
            config={modelConfig}
            onChange={(config) => {
              setModelConfig(config);
              setHasChanges(true);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="My Prompt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="A brief description..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {selectedVersion && (
            <Card>
              <CardHeader>
                <CardTitle>Version Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span>Version {selectedVersion.version}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedVersion.createdBy?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatDistanceToNow(new Date(selectedVersion.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {selectedVersion.note && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      {selectedVersion.note}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
