"use client";

import { useState, useEffect, use } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Settings,
  Users,
  Building2,
  EyeOff,
  FolderTree,
  Shield,
  Webhook,
  Database,
  GitBranch,
} from "lucide-react";

interface ProjectSettings {
  name: string;
  slug: string;
  description?: string;
  visibility: "public" | "private";
  inheritFromParent: boolean;
  parentId: string | null;
}

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [projectId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`);
      const data = await res.json();

      if (res.ok) {
        setSettings(data.settings);
        setCanManage(data.canManage);
        setUserRole(data.userRole);
      } else {
        toast.error(data.error || "Failed to load settings");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (res.ok) {
        setSettings(data.settings);
        toast.success("Settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg">
          Failed to load project settings
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
          <h1 className="text-2xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground">{settings.name}</p>
        </div>
        {userRole && (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {userRole === "full" ? "Full Access" : userRole}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 border-b pb-4">
        <Button variant="secondary" className="gap-2">
          <Settings className="h-4 w-4" />
          General
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/members`}>
            <Users className="h-4 w-4" />
            Members
          </Link>
        </Button>
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/webhooks`}>
            <Webhook className="h-4 w-4" />
            Webhooks
          </Link>
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Basic information about this project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) =>
                  setSettings({ ...settings, name: e.target.value })
                }
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={settings.slug}
                onChange={(e) =>
                  setSettings({ ...settings, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                }
                placeholder="my-project"
                disabled={!canManage}
              />
              <p className="text-sm text-muted-foreground">
                Used in URLs: /projects/<span className="font-mono">{settings.slug || 'my-project'}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={settings.description || ""}
                onChange={(e) =>
                  setSettings({ ...settings, description: e.target.value })
                }
                placeholder="Optional project description"
                disabled={!canManage}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Control</CardTitle>
            <CardDescription>
              Configure who can access this project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={settings.visibility}
                onValueChange={(value: "public" | "private") =>
                  setSettings({ ...settings, visibility: value })
                }
                disabled={!canManage}
              >
                <SelectTrigger id="visibility" className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Organization
                        </div>
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      All organization members can access this project based on their org role
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4" />
                          Private
                        </div>
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Only users explicitly added as project members can access this project
                    </TooltipContent>
                  </Tooltip>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {settings.visibility === "public"
                  ? "All organization members can access this project based on their org role."
                  : "Only users explicitly added as project members can access this project."}
              </p>
            </div>

            <Separator />

            {settings.parentId && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="inherit" className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Inherit from Parent Folder
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Users with access to the parent folder will also have access
                    to this project
                  </p>
                </div>
                <Switch
                  id="inherit"
                  checked={settings.inheritFromParent}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, inheritFromParent: checked })
                  }
                  disabled={!canManage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
