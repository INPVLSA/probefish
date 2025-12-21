"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Settings,
  Users,
  Webhook,
  Plus,
  MoreVertical,
  PlayCircle,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  GitBranch,
} from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WebhookData {
  _id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive" | "failed";
  onlyOnFailure?: boolean;
  onlyOnRegression?: boolean;
  lastDelivery?: string;
  lastSuccess?: string;
  lastFailure?: string;
  consecutiveFailures: number;
  createdAt: string;
}

const EVENT_OPTIONS = [
  { value: "test.run.completed", label: "Test Run Completed" },
  { value: "test.run.failed", label: "Test Run Failed" },
  { value: "test.regression.detected", label: "Regression Detected" },
];

export default function WebhooksSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["test.run.completed"]);
  const [onlyOnFailure, setOnlyOnFailure] = useState(false);
  const [onlyOnRegression, setOnlyOnRegression] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`);
      const data = await res.json();
      if (res.ok) {
        setWebhooks(data.webhooks);
      } else {
        toast.error(data.error || "Failed to load webhooks");
      }
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim() || events.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          events,
          onlyOnFailure,
          onlyOnRegression,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWebhooks([data.webhook, ...webhooks]);
        setNewWebhookSecret(data.webhook.secret);
        resetForm();
        toast.success("Webhook created successfully");
      } else {
        toast.error(data.error || "Failed to create webhook");
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (webhook: WebhookData) => {
    const newStatus = webhook.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(
        `/api/projects/${projectId}/webhooks/${webhook._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        setWebhooks(
          webhooks.map((w) =>
            w._id === webhook._id ? { ...w, status: newStatus } : w
          )
        );
        toast.success(`Webhook ${newStatus === "active" ? "enabled" : "disabled"}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update webhook");
      }
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const handleTest = async (webhookId: string) => {
    setTesting(webhookId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/webhooks/${webhookId}/test`,
        { method: "POST" }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(`Test delivered successfully (${data.statusCode})`);
      } else {
        toast.error(`Test failed: ${data.error || `HTTP ${data.statusCode}`}`);
      }
    } catch {
      toast.error("Failed to test webhook");
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/webhooks/${webhookId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setWebhooks(webhooks.filter((w) => w._id !== webhookId));
        toast.success("Webhook deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete webhook");
      }
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const resetForm = () => {
    setName("");
    setUrl("");
    setEvents(["test.run.completed"]);
    setOnlyOnFailure(false);
    setOnlyOnRegression(false);
    setShowCreateDialog(false);
  };

  const copySecret = () => {
    if (newWebhookSecret) {
      navigator.clipboard.writeText(newWebhookSecret);
      toast.success("Secret copied to clipboard");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (webhook: WebhookData) => {
    if (webhook.status === "failed") {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }
    if (webhook.status === "inactive") {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </Badge>
    );
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground">Webhooks</p>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-4">
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings`}>
            <Settings className="h-4 w-4" />
            General
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/members`}>
            <Users className="h-4 w-4" />
            Members
          </Link>
        </Button>
        <Button variant="secondary" className="gap-2">
          <Webhook className="h-4 w-4" />
          Webhooks
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/data`}>
            <Database className="h-4 w-4" />
            Data
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/cicd`}>
            <GitBranch className="h-4 w-4" />
            CI/CD
          </Link>
        </Button>
      </div>

      {/* Secret Display Dialog */}
      <Dialog
        open={!!newWebhookSecret}
        onOpenChange={() => setNewWebhookSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              Save this secret now. It won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
            <code className="flex-1 break-all">{newWebhookSecret}</code>
            <Button variant="ghost" size="icon" onClick={copySecret}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this secret to verify webhook signatures. The signature is sent
            in the <code>X-Webhook-Signature</code> header as{" "}
            <code>sha256=&lt;signature&gt;</code>.
          </p>
          <DialogFooter>
            <Button onClick={() => setNewWebhookSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Receive notifications when tests complete or fail
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Webhook</DialogTitle>
                  <DialogDescription>
                    Add a new webhook to receive test notifications
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Name</Label>
                    <Input
                      id="webhook-name"
                      placeholder="My Webhook"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://example.com/webhook"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Events</Label>
                    <div className="space-y-2">
                      {EVENT_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={option.value}
                            checked={events.includes(option.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEvents([...events, option.value]);
                              } else {
                                setEvents(events.filter((e) => e !== option.value));
                              }
                            }}
                          />
                          <label
                            htmlFor={option.value}
                            className="text-sm leading-none cursor-pointer"
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Filters</Label>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="only-failure" className="text-sm">
                          Only on failure
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Only trigger when tests fail
                        </p>
                      </div>
                      <Switch
                        id="only-failure"
                        checked={onlyOnFailure}
                        onCheckedChange={setOnlyOnFailure}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="only-regression" className="text-sm">
                          Only on regression
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Only trigger when regressions detected
                        </p>
                      </div>
                      <Switch
                        id="only-regression"
                        checked={onlyOnRegression}
                        onCheckedChange={setOnlyOnRegression}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Webhook
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">
                Add a webhook to receive notifications when tests complete
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Delivery</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook._id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-sm">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event.split(".").pop()}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(webhook)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(webhook.lastDelivery)}
                      </div>
                      {webhook.consecutiveFailures > 0 && (
                        <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                          <XCircle className="h-3 w-3" />
                          {webhook.consecutiveFailures} failures
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTest(webhook._id)}
                            disabled={testing === webhook._id}
                          >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            {testing === webhook._id ? "Testing..." : "Test"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(webhook)}
                          >
                            {webhook.status === "active" ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(webhook._id)}
                            className="text-destructive"
                          >
                            <DeleteIcon size={16} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
