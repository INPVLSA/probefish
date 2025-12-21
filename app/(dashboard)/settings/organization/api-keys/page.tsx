"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import { OpenAILogo } from "@/components/ui/openai-logo";
import { AnthropicLogo } from "@/components/ui/anthropic-logo";
import { GeminiLogo } from "@/components/ui/gemini-logo";

interface ApiKeyInfo {
  configured: boolean;
  maskedKey?: string;
  lastUpdated?: string;
}

type ApiKeys = Record<string, ApiKeyInfo>;

const providerInfo = {
  openai: {
    name: "OpenAI",
    description: "GPT-4, GPT-3.5, and other OpenAI models",
    placeholder: "sk-...",
    icon: OpenAILogo,
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3, Claude 2, and other Anthropic models",
    placeholder: "sk-ant-...",
    icon: AnthropicLogo,
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini Pro and other Google AI models",
    placeholder: "AIza...",
    icon: GeminiLogo,
  },
};

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();

      if (!meData.organizations?.[0]?.id) {
        toast.error("No organization found");
        setLoading(false);
        return;
      }

      const id = meData.organizations[0].id;
      setOrgId(id);

      const res = await fetch(`/api/organizations/${id}/api-keys`);
      const data = await res.json();

      if (res.ok) {
        setApiKeys(data.keys || {});
      } else {
        toast.error(data.error || "Failed to load API keys");
      }
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    if (!orgId || !newKey) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: newKey }),
      });

      const data = await res.json();

      if (res.ok) {
        setApiKeys({
          ...apiKeys,
          [provider]: { configured: true, maskedKey: data.maskedKey },
        });
        setEditingProvider(null);
        setNewKey("");
        toast.success(`${providerInfo[provider as keyof typeof providerInfo]?.name || provider} API key saved`);
      } else {
        toast.error(data.error || "Failed to save API key");
      }
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async (provider: string) => {
    if (!orgId || !newKey) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/api-keys/${provider}/rotate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: newKey }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setApiKeys({
          ...apiKeys,
          [provider]: { ...apiKeys[provider], maskedKey: data.maskedKey },
        });
        setEditingProvider(null);
        setNewKey("");
        toast.success("API key rotated successfully");
      } else {
        toast.error(data.error || "Failed to rotate API key");
      }
    } catch {
      toast.error("Failed to rotate API key");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!orgId) return;

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/api-keys/${provider}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setApiKeys({
          ...apiKeys,
          [provider]: { configured: false, maskedKey: undefined },
        });
        toast.success("API key deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete API key");
      }
    } catch {
      toast.error("Failed to delete API key");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Configure API keys for LLM providers. Keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(providerInfo).map(([provider, info]) => {
            const keyConfig = apiKeys[provider];
            const isConfigured = keyConfig?.configured;
            const isEditing = editingProvider === provider;

            return (
              <div
                key={provider}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <info.icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{info.name}</span>
                      {isConfigured ? (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <X className="h-3 w-3" />
                          Not Set
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {info.description}
                    </p>
                    {isConfigured && keyConfig?.maskedKey && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {keyConfig.maskedKey}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isConfigured ? (
                    <>
                      <Dialog
                        open={isEditing}
                        onOpenChange={(open) => {
                          setEditingProvider(open ? provider : null);
                          if (!open) {
                            setNewKey("");
                            setShowKey(false);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rotate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rotate {info.name} API Key</DialogTitle>
                            <DialogDescription>
                              Enter a new API key to replace the existing one.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-key">New API Key</Label>
                              <div className="relative">
                                <Input
                                  id="new-key"
                                  type={showKey ? "text" : "password"}
                                  placeholder={info.placeholder}
                                  value={newKey}
                                  onChange={(e) => setNewKey(e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3"
                                  onClick={() => setShowKey(!showKey)}
                                >
                                  {showKey ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingProvider(null);
                                setNewKey("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleRotateKey(provider)}
                              disabled={!newKey || saving}
                            >
                              {saving && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              Save New Key
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <DeleteIcon size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the {info.name} API key?
                              You won&apos;t be able to use {info.name} models until you add a new key.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteKey(provider)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <Dialog
                      open={isEditing}
                      onOpenChange={(open) => {
                        setEditingProvider(open ? provider : null);
                        if (!open) {
                          setNewKey("");
                          setShowKey(false);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Key className="h-4 w-4 mr-2" />
                          Add Key
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add {info.name} API Key</DialogTitle>
                          <DialogDescription>
                            Enter your API key to enable {info.name} models.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <div className="relative">
                              <Input
                                id="api-key"
                                type={showKey ? "text" : "password"}
                                placeholder={info.placeholder}
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowKey(!showKey)}
                              >
                                {showKey ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingProvider(null);
                              setNewKey("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSaveKey(provider)}
                            disabled={!newKey || saving}
                          >
                            {saving && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Save Key
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>How your API keys are protected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Encryption:</strong> All API keys are encrypted using AES-256-GCM
            before being stored in the database.
          </p>
          <p>
            <strong>Access:</strong> Keys are only decrypted when making requests to
            LLM providers and are never exposed in the UI.
          </p>
          <p>
            <strong>Masking:</strong> Only the first and last 4 characters of keys are
            shown for identification purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
