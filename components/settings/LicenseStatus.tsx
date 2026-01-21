"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Key, Trash2, Check, X, Shield } from "lucide-react";
import type { PlanTier } from "@/lib/license/types";
import type { PlanFeatures } from "@/lib/license/features";
import type { LicenseStatusSummary } from "@/lib/license/access";

interface LicenseStatusProps {
  organizationId: string;
}

interface LicenseStatusData extends LicenseStatusSummary {
  features: PlanFeatures;
}

function getPlanLabel(plan: PlanTier, deploymentMode?: "self-hosted" | "cloud"): string {
  const prefix = deploymentMode === "cloud" ? "Cloud" : "Self-Hosted";
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return `${prefix} ${planName}`;
}

const PLAN_COLORS: Record<PlanTier, string> = {
  free: "bg-gray-500",
  pro: "bg-blue-600",
  enterprise: "bg-amber-500",
};

export function LicenseStatus({ organizationId }: LicenseStatusProps) {
  const [data, setData] = useState<LicenseStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const fetchLicenseStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/license`);
      const json = await res.json();

      if (res.ok) {
        setData(json);
      } else {
        toast.error(json.error || "Failed to load license status");
      }
    } catch {
      toast.error("Failed to load license status");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchLicenseStatus();
  }, [fetchLicenseStatus]);

  const handleSetLicense = async () => {
    if (!licenseKey.trim()) {
      toast.error("Please enter a license key");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const json = await res.json();

      if (res.ok) {
        toast.success(`License activated: ${getPlanLabel(json.plan as PlanTier, json.deploymentMode)} plan`);
        setLicenseKey("");
        setShowKeyInput(false);
        fetchLicenseStatus();
      } else {
        toast.error(json.error || "Failed to activate license");
      }
    } catch {
      toast.error("Failed to activate license");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLicense = async () => {
    if (!confirm("Are you sure you want to remove the license key? Your organization will revert to the Free plan.")) {
      return;
    }

    setRemoving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/license`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (res.ok) {
        toast.success("License key removed");
        fetchLicenseStatus();
      } else {
        toast.error(json.error || "Failed to remove license");
      }
    } catch {
      toast.error("Failed to remove license");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Failed to load license status
        </CardContent>
      </Card>
    );
  }

  const formatLimit = (value: number | null | undefined) => {
    if (value == null) {
      return "N/A";
    }
    if (value === Infinity || value === Number.MAX_SAFE_INTEGER) {
      return "Unlimited";
    }
    return value.toLocaleString();
  };

  const calculateProgress = (current: number | null | undefined, max: number | null | undefined) => {
    if (current == null || max == null || max === Infinity || max === Number.MAX_SAFE_INTEGER || max === 0) {
      return 0;
    }
    return Math.min((current / max) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                License
              </CardTitle>
              <CardDescription>
                Your current plan and license status
              </CardDescription>
            </div>
            <Badge className={PLAN_COLORS[data.plan]}>
              {getPlanLabel(data.plan, data.deploymentMode)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.license && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Licensed to</span>
                <span className="text-sm font-medium">{data.license.organizationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="text-sm font-medium">
                  {new Date(data.license.expiresAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Seats</span>
                <span className="text-sm font-medium">{data.license.seats}</span>
              </div>
            </div>
          )}

          {/* Features List */}
          {data.features && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Features</h4>
              <div className="grid grid-cols-2 gap-3">
                {(["apiAccess", "webhooks", "sso", "auditLog", "customBranding", "advancedAnalytics", "prioritySupport"] as const).map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    {data.features?.[feature] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={`text-sm ${data.features?.[feature] ? "" : "text-muted-foreground"}`}>
                      {feature === "apiAccess" && "API Access"}
                      {feature === "webhooks" && "Webhooks"}
                      {feature === "sso" && "SSO / SAML"}
                      {feature === "auditLog" && "Audit Logging"}
                      {feature === "customBranding" && "Custom Branding"}
                      {feature === "advancedAnalytics" && "Advanced Analytics"}
                      {feature === "prioritySupport" && "Priority Support"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage Limits */}
          {data.usage && data.features && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Usage This Month</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Test Runs</span>
                    <span>
                      {(data.usage.testRunsThisMonth ?? 0).toLocaleString()} / {formatLimit(data.features?.maxTestRunsPerMonth)}
                    </span>
                  </div>
                  <Progress
                    value={calculateProgress(data.usage.testRunsThisMonth, data.features?.maxTestRunsPerMonth)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Limits */}
          {data.features && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Plan Limits</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Projects</span>
                  <span className="font-medium">{formatLimit(data.features?.maxProjects)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Test Runs / Month</span>
                  <span className="font-medium">{formatLimit(data.features?.maxTestRunsPerMonth)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team Members</span>
                  <span className="font-medium">{formatLimit(data.features?.maxTeamMembers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Endpoints</span>
                  <span className="font-medium">{formatLimit(data.features?.maxEndpoints)}</span>
                </div>
              </div>
            </div>
          )}

          {/* License Key Management */}
          <div className="border-t pt-4 space-y-4">
            {data.isLicensed ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">License key is active</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveLicense}
                  disabled={removing}
                >
                  {removing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove License
                </Button>
              </div>
            ) : showKeyInput ? (
              <div className="space-y-3">
                <Label htmlFor="licenseKey">License Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="licenseKey"
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Enter your license key"
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleSetLicense} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4" />
                    )}
                    Activate
                  </Button>
                  <Button variant="outline" onClick={() => setShowKeyInput(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Have a license key? Activate it to unlock additional features.
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowKeyInput(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  Enter License Key
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
