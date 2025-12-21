"use client";

import { useState, useRef } from "react";
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
import { Download, FileJson, FileCode, FileSpreadsheet, Loader2 } from "lucide-react";
import { DownloadIcon, DownloadIconHandle } from "@/components/ui/download";
import { cn } from "@/lib/utils";

type ExportFormat = "json" | "junit" | "csv";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  suiteId?: string;
  title?: string;
}

const formats: { id: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "json",
    label: "JSON",
    description: "Full data for backup & migration",
    icon: <FileJson className="h-5 w-5" />,
  },
  {
    id: "junit",
    label: "JUnit XML",
    description: "CI/CD integration",
    icon: <FileCode className="h-5 w-5" />,
  },
  {
    id: "csv",
    label: "CSV",
    description: "Spreadsheets (ZIP)",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
];

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  suiteId,
  title = "Export Data",
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState("10");
  const [loading, setLoading] = useState(false);
  const downloadIconRef = useRef<DownloadIconHandle>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        includeHistory: includeHistory.toString(),
        historyLimit,
      });

      const url = suiteId
        ? `/api/projects/${projectId}/test-suites/${suiteId}/export?${params}`
        : `/api/projects/${projectId}/export?${params}`;

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export.${format === "csv" ? "zip" : format === "junit" ? "xml" : "json"}`;

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      alert(error instanceof Error ? error.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Export your {suiteId ? "test suite" : "project"} data in different formats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors cursor-pointer",
                    format === f.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                  )}
                >
                  {f.icon}
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {f.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-history">Include Run History</Label>
              <p className="text-xs text-muted-foreground">
                Include test execution results
              </p>
            </div>
            <Switch
              id="include-history"
              checked={includeHistory}
              onCheckedChange={setIncludeHistory}
            />
          </div>

          {includeHistory && (
            <div className="space-y-2">
              <Label htmlFor="history-limit">History Limit</Label>
              <Select value={historyLimit} onValueChange={setHistoryLimit}>
                <SelectTrigger id="history-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Last 5 runs</SelectItem>
                  <SelectItem value="10">Last 10 runs</SelectItem>
                  <SelectItem value="25">Last 25 runs</SelectItem>
                  <SelectItem value="50">Last 50 runs</SelectItem>
                  <SelectItem value="100">Last 100 runs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading}
            onMouseEnter={() => downloadIconRef.current?.startAnimation()}
            onMouseLeave={() => downloadIconRef.current?.stopAnimation()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon ref={downloadIconRef} size={16} className="mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
