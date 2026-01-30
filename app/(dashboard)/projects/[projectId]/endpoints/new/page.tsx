"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { EndpointForm, EndpointConfig } from "@/components/endpoint/EndpointForm";
import { toast } from "sonner";

const defaultConfig: EndpointConfig = {
  method: "POST",
  url: "",
  headers: {},
  auth: { type: "none" },
  bodyTemplate: "",
  contentType: "application/json",
  responseContentPath: "",
};

export default function NewEndpointPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<EndpointConfig>(defaultConfig);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Endpoint name is required");
      return;
    }

    if (!config.url.trim()) {
      setError("Endpoint URL is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/endpoints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          config,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create endpoint");
        return;
      }

      toast.success("Endpoint created successfully!");
      router.push(`/projects/${projectId}/endpoints/${data.endpoint.slug}`);
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
          <h1 className="text-2xl font-bold">New Endpoint</h1>
          <p className="text-muted-foreground">
            Configure an external HTTP API endpoint to test
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="max-w-3xl space-y-6">
          <EndpointForm
            name={name}
            description={description}
            config={config}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onConfigChange={setConfig}
          />

          <div className="flex gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href={`/projects/${projectId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Creating..." : "Create Endpoint"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
