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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Settings,
  Users,
  Shield,
  Webhook,
  Database,
  Download,
  Upload,
  FileJson,
  FileCode,
  FileSpreadsheet,
  GitBranch,
} from "lucide-react";
import { ExportDialog } from "@/components/export/ExportDialog";
import { ImportDialog } from "@/components/import/ImportDialog";

interface ProjectInfo {
  name: string;
}

export default function ProjectDataPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`);
      const data = await res.json();

      if (res.ok) {
        setProject({ name: data.settings.name });
        setUserRole(data.userRole);
        setCanEdit(data.canManage);
      } else {
        toast.error(data.error || "Failed to load project");
      }
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-lg">
          Failed to load project
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
          <p className="text-muted-foreground">{project.name}</p>
        </div>
        {userRole && (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {userRole === "full" ? "Full Access" : userRole}
          </Badge>
        )}
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
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`/projects/${projectId}/settings/webhooks`}>
            <Webhook className="h-4 w-4" />
            Webhooks
          </Link>
        </Button>
        <Button variant="secondary" className="gap-2">
          <Database className="h-4 w-4" />
          Data
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
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Export all project data including prompts, endpoints, test suites, and webhooks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileJson className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">JSON</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full fidelity export for backup and migration between Probefish instances
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-5 w-5 text-green-500" />
                  <span className="font-medium">JUnit XML</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Standard format for CI/CD integration with Jenkins, GitHub Actions, etc.
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">CSV (ZIP)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Spreadsheet-friendly format for analysis in Excel, Google Sheets, etc.
                </p>
              </div>
            </div>
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export Project Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Import data from a previously exported JSON file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Import Options:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>
                  <strong>Merge mode:</strong> Add new items without affecting existing ones
                </li>
                <li>
                  <strong>Replace mode:</strong> Update existing items with imported data
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Note: Import only supports JSON format. Credentials and secrets are never exported or imported for security.
              </p>
            </div>
            <Button onClick={() => setImportDialogOpen(true)} disabled={!canEdit}>
              <Upload className="mr-2 h-4 w-4" />
              Import Data
            </Button>
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                You need edit permissions to import data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId}
        title="Export Project"
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        projectId={projectId}
        onImportComplete={() => {
          toast.success("Import completed! Refresh to see changes.");
        }}
      />
    </div>
  );
}
