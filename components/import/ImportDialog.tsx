"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  FileJson,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ImportMode = "merge" | "replace";

interface ImportPreview {
  valid: boolean;
  errors: Array<{ path: string; message: string; code: string }>;
  warnings: Array<{ path: string; message: string }>;
  counts: {
    prompts: { new: number; existing: number; total: number };
    endpoints: { new: number; existing: number; total: number };
    testSuites: { new: number; existing: number; total: number };
    webhooks: { new: number; existing: number; total: number };
  };
  conflicts: Array<{
    type: string;
    name: string;
    exportId: string;
    existingId: string;
  }>;
}

interface ImportResult {
  success: boolean;
  counts: {
    prompts: { created: number; updated: number; skipped: number };
    endpoints: { created: number; updated: number; skipped: number };
    testSuites: { created: number; updated: number; skipped: number };
    webhooks: { created: number; updated: number; skipped: number };
  };
  errors: Array<{ path: string; message: string; code: string }>;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImportComplete?: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  projectId,
  onImportComplete,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [skipExisting, setSkipExisting] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [dragActive, setDragActive] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep("upload");
    setMode("merge");
    setSkipExisting(true);
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        reset();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, reset]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/json" || droppedFile.name.endsWith(".json")) {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }, []);

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${projectId}/import`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to preview import");
      }

      setPreview(data.preview);
      setStep("preview");
    } catch (error) {
      console.error("Preview error:", error);
      alert(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("skipExisting", skipExisting.toString());

      const response = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data.result);
      setStep("result");
      onImportComplete?.();
    } catch (error) {
      console.error("Import error:", error);
      alert(error instanceof Error ? error.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const renderUploadStep = () => (
    <>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          file && "border-primary bg-primary/5"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileJson className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={() => setFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a JSON export file, or
            </p>
            <label>
              <Button variant="secondary" asChild>
                <span>Browse Files</span>
              </Button>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => handleClose(false)}>
          Cancel
        </Button>
        <Button onClick={handlePreview} disabled={!file || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            "Preview Import"
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderPreviewStep = () => {
    if (!preview) return null;

    return (
      <>
        <div className="space-y-4">
          {!preview.valid && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 font-medium mb-2">
                <AlertCircle className="h-4 w-4" />
                Validation Errors
              </div>
              <ul className="text-sm space-y-1 ml-6 list-disc">
                {preview.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{err.path}</span>: {err.message}
                  </li>
                ))}
                {preview.errors.length > 5 && (
                  <li className="text-muted-foreground">
                    ...and {preview.errors.length - 5} more errors
                  </li>
                )}
              </ul>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </div>
              <ul className="text-sm space-y-1 ml-6 list-disc">
                {preview.warnings.map((warn, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{warn.path}</span>: {warn.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.valid && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">
                    {preview.counts.prompts.new + preview.counts.endpoints.new +
                      preview.counts.testSuites.new + preview.counts.webhooks.new}
                  </div>
                  <div className="text-sm text-muted-foreground">New items</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-600">
                    {preview.conflicts.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Conflicts</div>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Prompts:</span>
                  <span>
                    {preview.counts.prompts.new} new, {preview.counts.prompts.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Endpoints:</span>
                  <span>
                    {preview.counts.endpoints.new} new, {preview.counts.endpoints.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Test Suites:</span>
                  <span>
                    {preview.counts.testSuites.new} new, {preview.counts.testSuites.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Webhooks:</span>
                  <span>
                    {preview.counts.webhooks.new} new, {preview.counts.webhooks.existing} existing
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Import Mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">Merge (add new items)</SelectItem>
                      <SelectItem value="replace">Replace (update existing)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === "merge" && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Skip Existing</Label>
                      <p className="text-xs text-muted-foreground">
                        Don&apos;t modify items that already exist
                      </p>
                    </div>
                    <Switch checked={skipExisting} onCheckedChange={setSkipExisting} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button onClick={handleImport} disabled={!preview.valid || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderResultStep = () => {
    if (!result) return null;

    const totalCreated =
      result.counts.prompts.created +
      result.counts.endpoints.created +
      result.counts.testSuites.created +
      result.counts.webhooks.created;

    const totalUpdated =
      result.counts.prompts.updated +
      result.counts.endpoints.updated +
      result.counts.testSuites.updated +
      result.counts.webhooks.updated;

    return (
      <>
        <div className="space-y-4">
          {result.success ? (
            <div className="bg-green-500/10 text-green-600 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Import Successful
              </div>
            </div>
          ) : (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 font-medium mb-2">
                <AlertCircle className="h-5 w-5" />
                Import Completed with Errors
              </div>
              <ul className="text-sm space-y-1 ml-6 list-disc">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{err.path}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{totalCreated}</div>
              <div className="text-sm text-muted-foreground">Created</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalUpdated}</div>
              <div className="text-sm text-muted-foreground">Updated</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {result.counts.prompts.skipped +
                  result.counts.endpoints.skipped +
                  result.counts.testSuites.skipped +
                  result.counts.webhooks.skipped}
              </div>
              <div className="text-sm text-muted-foreground">Skipped</div>
            </div>
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Prompts:</span>
              <span>
                {result.counts.prompts.created} created, {result.counts.prompts.updated} updated,{" "}
                {result.counts.prompts.skipped} skipped
              </span>
            </div>
            <div className="flex justify-between">
              <span>Endpoints:</span>
              <span>
                {result.counts.endpoints.created} created, {result.counts.endpoints.updated} updated,{" "}
                {result.counts.endpoints.skipped} skipped
              </span>
            </div>
            <div className="flex justify-between">
              <span>Test Suites:</span>
              <span>
                {result.counts.testSuites.created} created, {result.counts.testSuites.updated} updated,{" "}
                {result.counts.testSuites.skipped} skipped
              </span>
            </div>
            <div className="flex justify-between">
              <span>Webhooks:</span>
              <span>
                {result.counts.webhooks.created} created, {result.counts.webhooks.updated} updated,{" "}
                {result.counts.webhooks.skipped} skipped
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => handleClose(false)}>Done</Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </DialogTitle>
          <DialogDescription>
            Import data from a previously exported JSON file.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && renderUploadStep()}
        {step === "preview" && renderPreviewStep()}
        {step === "result" && renderResultStep()}
      </DialogContent>
    </Dialog>
  );
}
