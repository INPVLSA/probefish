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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: {
    defaultJudgeModel?: string;
    maxConcurrentTests?: number;
  };
  userRole: string;
}

export default function OrganizationSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      // First get user's org ID
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();

      if (!meData.organizations?.[0]?.id) {
        toast.error("No organization found");
        setLoading(false);
        return;
      }

      const orgId = meData.organizations[0].id;
      const res = await fetch(`/api/organizations/${orgId}`);
      const data = await res.json();

      if (res.ok) {
        setOrg(data.organization);
        setName(data.organization.name);
        setSlug(data.organization.slug);
      } else {
        toast.error(data.error || "Failed to load organization");
      }
    } catch {
      toast.error("Failed to load organization");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!org) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json();

      if (res.ok) {
        setOrg({ ...org, name: data.organization.name, slug: data.organization.slug });
        toast.success("Organization updated successfully");
      } else {
        toast.error(data.error || "Failed to update organization");
      }
    } catch {
      toast.error("Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = () => {
    const newSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setSlug(newSlug);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No organization found
        </CardContent>
      </Card>
    );
  }

  const canEdit = ["owner", "admin"].includes(org.userRole);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-organization"
                disabled={!canEdit}
              />
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateSlug}
                  disabled={!name}
                >
                  Generate
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, and hyphens allowed
            </p>
          </div>

          {canEdit && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Role</CardTitle>
          <CardDescription>
            Your permissions in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {org.userRole === "super_admin" && "Super Admin"}
              {org.userRole === "owner" && "Owner"}
              {org.userRole === "admin" && "Admin"}
              {org.userRole === "member" && "Member"}
              {org.userRole === "viewer" && "Viewer"}
            </span>
            <span className="text-xs text-muted-foreground">
              {org.userRole === "super_admin" && "- Platform-wide access to all organizations"}
              {org.userRole === "owner" && "- Full access to all settings"}
              {org.userRole === "admin" && "- Can manage members and settings"}
              {org.userRole === "member" && "- Can create and edit content"}
              {org.userRole === "viewer" && "- Read-only access"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
