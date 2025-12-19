"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import { EndpointForm, EndpointConfig } from "@/components/endpoint/EndpointForm";
import { EndpointTester } from "@/components/endpoint/EndpointTester";
import { toast } from "sonner";

interface Endpoint {
  _id: string;
  name: string;
  description?: string;
  config: EndpointConfig;
  variables: string[];
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error";
}

const defaultConfig: EndpointConfig = {
  method: "POST",
  url: "",
  headers: {},
  auth: { type: "none" },
  bodyTemplate: "",
  contentType: "application/json",
  responseContentPath: "",
};

export default function EditEndpointPage({
  params,
}: {
  params: Promise<{ projectId: string; endpointId: string }>;
}) {
  const { projectId, endpointId } = use(params);
  const router = useRouter();

  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<EndpointConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchEndpoint = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/endpoints/${endpointId}`
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch endpoint");
          return;
        }

        setEndpoint(data.endpoint);
        setName(data.endpoint.name);
        setDescription(data.endpoint.description || "");

        // Convert headers Map to object if needed
        const headers = data.endpoint.config.headers instanceof Map
          ? Object.fromEntries(data.endpoint.config.headers)
          : data.endpoint.config.headers || {};

        setConfig({
          method: data.endpoint.config.method || "POST",
          url: data.endpoint.config.url || "",
          headers,
          auth: data.endpoint.config.auth || { type: "none" },
          bodyTemplate: data.endpoint.config.bodyTemplate || "",
          contentType: data.endpoint.config.contentType || "application/json",
          responseContentPath: data.endpoint.config.responseContentPath || "",
        });
      } catch {
        setError("Failed to fetch endpoint");
      } finally {
        setLoading(false);
      }
    };

    fetchEndpoint();
  }, [projectId, endpointId]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    setHasChanges(true);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    setHasChanges(true);
  };

  const handleConfigChange = (newConfig: EndpointConfig) => {
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Endpoint name is required");
      return;
    }

    if (!config.url.trim()) {
      setError("Endpoint URL is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/endpoints/${endpointId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            config,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save endpoint");
        return;
      }

      setEndpoint(data.endpoint);
      setHasChanges(false);
      toast.success("Endpoint saved!");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this endpoint?")) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/endpoints/${endpointId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete endpoint");
        return;
      }

      toast.success("Endpoint deleted!");
      router.push(`/projects/${projectId}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading endpoint...</div>
      </div>
    );
  }

  if (error && !endpoint) {
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

  // Extract variables from current config
  const variables = (() => {
    if (!config.bodyTemplate) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(config.bodyTemplate)) !== null) {
      const varName = match[1].trim();
      if (!vars.includes(varName)) {
        vars.push(varName);
      }
    }
    return vars;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{endpoint?.name}</h1>
          {endpoint?.description && (
            <p className="text-muted-foreground">{endpoint.description}</p>
          )}
        </div>
        <Button
          variant="destructive"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
        >
          <DeleteIcon size={16} />
        </Button>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EndpointForm
            name={name}
            description={description}
            config={config}
            onNameChange={handleNameChange}
            onDescriptionChange={handleDescriptionChange}
            onConfigChange={handleConfigChange}
          />
        </div>
        <div>
          <EndpointTester
            projectId={projectId}
            endpointId={endpointId}
            variables={variables}
          />
        </div>
      </div>
    </div>
  );
}
