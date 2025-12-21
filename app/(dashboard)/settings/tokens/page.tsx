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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Key,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import { formatDistanceToNow } from "date-fns";

interface AccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isExpired: boolean;
}

const SCOPES = [
  { id: "projects:read", label: "Read Projects", description: "View projects and their contents" },
  { id: "projects:write", label: "Write Projects", description: "Create and modify projects" },
  { id: "test-suites:read", label: "Read Test Suites", description: "View test suites and test cases" },
  { id: "test-suites:write", label: "Write Test Suites", description: "Create and modify test suites" },
  { id: "test-runs:execute", label: "Execute Tests", description: "Run tests and view results" },
  { id: "exports:read", label: "Export Data", description: "Export data in various formats" },
];

const EXPIRATION_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "never", label: "No expiration" },
];

export default function TokensPage() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiration, setExpiration] = useState("30d");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch("/api/user/tokens");
      const data = await res.json();

      if (res.ok) {
        setTokens(data.tokens || []);
      } else {
        toast.error(data.error || "Failed to load tokens");
      }
    } catch {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      toast.error("Token name is required");
      return;
    }

    if (selectedScopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/user/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTokenName.trim(),
          scopes: selectedScopes,
          expiresIn: expiration,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNewToken(data.token);
        setTokens([
          {
            id: data.id,
            name: data.name,
            tokenPrefix: data.tokenPrefix,
            scopes: data.scopes,
            expiresAt: data.expiresAt,
            lastUsedAt: null,
            createdAt: data.createdAt,
            isExpired: false,
          },
          ...tokens,
        ]);
        toast.success("Token created successfully");
      } else {
        toast.error(data.error || "Failed to create token");
      }
    } catch {
      toast.error("Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      const res = await fetch(`/api/user/tokens/${tokenId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTokens(tokens.filter((t) => t.id !== tokenId));
        toast.success("Token revoked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to revoke token");
      }
    } catch {
      toast.error("Failed to revoke token");
    }
  };

  const handleCopy = async () => {
    if (!newToken) return;

    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy token");
    }
  };

  const resetCreateDialog = () => {
    setNewTokenName("");
    setSelectedScopes([]);
    setExpiration("30d");
    setNewToken(null);
    setCopied(false);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetCreateDialog();
    }
    setCreateOpen(open);
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId]
    );
  };

  const selectAllScopes = () => {
    setSelectedScopes(SCOPES.map((s) => s.id));
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Personal Access Tokens</CardTitle>
              <CardDescription>
                Generate tokens to access the API from CI/CD pipelines or external tools.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Token
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                {newToken ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        Token Created
                      </DialogTitle>
                      <DialogDescription>
                        Copy your token now. You won&apos;t be able to see it again!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <code className="text-sm break-all">{newToken}</code>
                      </div>
                      <Button onClick={handleCopy} className="w-full">
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Token
                          </>
                        )}
                      </Button>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-yellow-500/10 p-3 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                        <p>
                          Make sure to copy your token now. For security reasons, it won&apos;t be shown again.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => handleDialogClose(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Generate New Token</DialogTitle>
                      <DialogDescription>
                        Create a personal access token for API access.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="token-name">Token Name</Label>
                        <Input
                          id="token-name"
                          placeholder="e.g., GitLab CI"
                          value={newTokenName}
                          onChange={(e) => setNewTokenName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Scopes</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={selectAllScopes}
                          >
                            Select All
                          </Button>
                        </div>
                        <div className="space-y-2 border rounded-lg p-3">
                          {SCOPES.map((scope) => (
                            <div
                              key={scope.id}
                              className="flex items-start gap-3"
                            >
                              <Checkbox
                                id={scope.id}
                                checked={selectedScopes.includes(scope.id)}
                                onCheckedChange={() => toggleScope(scope.id)}
                              />
                              <div className="grid gap-0.5">
                                <label
                                  htmlFor={scope.id}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {scope.label}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {scope.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expiration">Expiration</Label>
                        <Select value={expiration} onValueChange={setExpiration}>
                          <SelectTrigger id="expiration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPIRATION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => handleDialogClose(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={creating || !newTokenName.trim() || selectedScopes.length === 0}
                      >
                        {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Generate Token
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No access tokens yet</p>
              <p className="text-sm">Generate a token to access the API programmatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{token.name}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {token.tokenPrefix}...
                      </code>
                      {token.isExpired && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Created {formatDistanceToNow(new Date(token.createdAt), { addSuffix: true })}
                      </span>
                      {token.lastUsedAt && (
                        <span>
                          Last used {formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}
                        </span>
                      )}
                      {token.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {token.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <DeleteIcon size={16} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Token</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke &quot;{token.name}&quot;? Any applications
                          using this token will no longer be able to access the API.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(token.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>How to use your access token</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">HTTP Header</h4>
            <code className="block bg-muted p-3 rounded-lg text-sm">
              Authorization: Bearer pf_your_token_here
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">Example: Export Test Results (cURL)</h4>
            <code className="block bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
{`curl -H "Authorization: Bearer pf_your_token_here" \\
  "https://your-instance/api/projects/{projectId}/export?format=junit"`}
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">Example: Run Tests (cURL)</h4>
            <code className="block bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
{`curl -X POST -H "Authorization: Bearer pf_your_token_here" \\
  "https://your-instance/api/projects/{projectId}/test-suites/{suiteId}/run"`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
