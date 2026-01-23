"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Save, FileText, Globe } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  _id: string;
  name: string;
  currentVersion: number;
  versions: { version: number; variables: string[] }[];
}

interface Endpoint {
  _id: string;
  name: string;
  variables: string[];
}

export default function NewTestSuitePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<"prompt" | "endpoint">("prompt");
  const [targetId, setTargetId] = useState("");
  const [targetVersion, setTargetVersion] = useState<number | undefined>();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const [promptsRes, endpointsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/prompts`),
          fetch(`/api/projects/${projectId}/endpoints`),
        ]);

        const [promptsData, endpointsData] = await Promise.all([
          promptsRes.json(),
          endpointsRes.json(),
        ]);

        if (promptsRes.ok) {
          setPrompts(promptsData.prompts);
        }
        if (endpointsRes.ok) {
          setEndpoints(endpointsData.endpoints);
        }
      } catch {
        setError("Failed to load prompts and endpoints");
      } finally {
        setLoading(false);
      }
    };

    fetchTargets();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Test suite name is required");
      return;
    }

    if (!targetId) {
      setError("Please select a prompt or endpoint to test");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/test-suites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          targetType,
          targetId,
          targetVersion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create test suite");
        return;
      }

      toast.success("Test suite created!");
      router.push(`/projects/${projectId}/test-suites/${data.testSuite.slug}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const selectedPrompt = prompts.find((p) => p._id === targetId);
  const targets = targetType === "prompt" ? prompts : endpoints;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Test Suite</h1>
          <p className="text-muted-foreground">
            Create a test suite to evaluate prompts or endpoints
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Name and describe your test suite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Support Tests"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this test suite validate?"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Target</CardTitle>
            <CardDescription>
              Select the prompt or endpoint you want to test
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={targetType === "prompt" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setTargetType("prompt");
                    setTargetId("");
                    setTargetVersion(undefined);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Prompt
                </Button>
                <Button
                  type="button"
                  variant={targetType === "endpoint" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setTargetType("endpoint");
                    setTargetId("");
                    setTargetVersion(undefined);
                  }}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Endpoint
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Select {targetType === "prompt" ? "Prompt" : "Endpoint"} *
              </Label>
              {targets.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  No {targetType === "prompt" ? "prompts" : "endpoints"} found.{" "}
                  <Link
                    href={`/projects/${projectId}/${
                      targetType === "prompt" ? "prompts" : "endpoints"
                    }/new`}
                    className="text-primary hover:underline"
                  >
                    Create one first.
                  </Link>
                </div>
              ) : (
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={`Select a ${
                        targetType === "prompt" ? "prompt" : "endpoint"
                      }`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target._id} value={target._id}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {targetType === "prompt" && selectedPrompt && (
              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={targetVersion === undefined ? "latest" : String(targetVersion)}
                  onValueChange={(v) => setTargetVersion(v === "latest" ? undefined : parseInt(v, 10))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">
                      Latest (always use current)
                    </SelectItem>
                    {selectedPrompt.versions.map((v) => (
                      <SelectItem key={v.version} value={String(v.version)}>
                        Version {v.version}
                        {v.version === selectedPrompt.currentVersion && " (current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {targetVersion === undefined
                    ? "Tests will always run against the current version of the prompt"
                    : `Tests will run against version ${targetVersion}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Creating..." : "Create Test Suite"}
          </Button>
        </div>
      </form>
    </div>
  );
}
