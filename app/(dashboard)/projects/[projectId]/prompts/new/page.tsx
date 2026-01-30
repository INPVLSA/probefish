"use client";

import { useState, use } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save } from "lucide-react";
import { PromptEditor } from "@/components/prompt/PromptEditor";
import { toast } from "sonner";

export default function NewPromptPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Prompt name is required");
      return;
    }

    if (!content.trim()) {
      setError("Prompt content is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          content,
          systemPrompt: systemPrompt.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create prompt");
        return;
      }

      toast.success("Prompt created successfully!");
      router.push(`/projects/${projectId}/prompts/${data.prompt.slug}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Prompt</h1>
          <p className="text-muted-foreground">
            Create a new prompt in this project
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Prompt Content</CardTitle>
                <CardDescription>
                  Write your prompt. Use {"{{variable}}"} syntax to define
                  variables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="user" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="user">User Prompt</TabsTrigger>
                    <TabsTrigger value="system">System Prompt</TabsTrigger>
                  </TabsList>
                  <TabsContent value="user" className="space-y-4">
                    <PromptEditor
                      value={content}
                      onChange={setContent}
                      variables={variables}
                      onVariablesChange={setVariables}
                      height="300px"
                    />
                  </TabsContent>
                  <TabsContent value="system" className="space-y-4">
                    <Textarea
                      placeholder="Enter system prompt (optional)..."
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
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
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Prompt"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A brief description..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" asChild>
                <Link href={`/projects/${projectId}`}>Cancel</Link>
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
