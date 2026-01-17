"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Check, X, Hash, Type, Code, Timer, ShieldCheck, AlertTriangle, Braces, FileJson, Copy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteIcon } from "@/components/ui/delete";

export interface ValidationRule {
  type:
    | "contains"
    | "excludes"
    | "minLength"
    | "maxLength"
    | "regex"
    | "jsonSchema"
    | "maxResponseTime"
    | "isJson"
    | "containsJson";
  value: string | number;
  message?: string;
  severity?: "fail" | "warning";
}

interface ValidationRulesEditorProps {
  rules: ValidationRule[];
  onChange: (rules: ValidationRule[]) => void;
}

const RULE_TYPES = [
  { value: "contains", label: "Contains", icon: Check, valueType: "string" },
  { value: "excludes", label: "Excludes", icon: X, valueType: "string" },
  { value: "minLength", label: "Min Length", icon: Hash, valueType: "number" },
  { value: "maxLength", label: "Max Length", icon: Hash, valueType: "number" },
  { value: "maxResponseTime", label: "Max Response Time", icon: Timer, valueType: "number" },
  { value: "regex", label: "Regex Pattern", icon: Type, valueType: "string" },
  { value: "jsonSchema", label: "JSON Schema", icon: Code, valueType: "json" },
  { value: "isJson", label: "Is JSON", icon: Braces, valueType: "none" },
  { value: "containsJson", label: "Contains JSON", icon: FileJson, valueType: "none" },
] as const;

export function ValidationRulesEditor({
  rules,
  onChange,
}: ValidationRulesEditorProps) {
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddRule = () => {
    setEditingRule({
      type: "contains",
      value: "",
      message: "",
      severity: "fail",
    });
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleEditRule = (rule: ValidationRule, index: number) => {
    setEditingRule({ ...rule });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleDeleteRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Rules that don't make sense to duplicate (singleton rules)
  const canDuplicate = (rule: ValidationRule): boolean => {
    return !["isJson", "containsJson"].includes(rule.type);
  };

  const handleDuplicateRule = (rule: ValidationRule) => {
    const duplicatedRule: ValidationRule = {
      ...rule,
      message: rule.message ? `${rule.message} (copy)` : undefined,
    };
    onChange([...rules, duplicatedRule]);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    // Convert value to number for numeric rules
    const finalRule = { ...editingRule };
    if (
      (finalRule.type === "minLength" || finalRule.type === "maxLength" || finalRule.type === "maxResponseTime") &&
      typeof finalRule.value === "string"
    ) {
      finalRule.value = parseInt(finalRule.value, 10) || 0;
    }

    if (editingIndex === null) {
      onChange([...rules, finalRule]);
    } else {
      const updated = [...rules];
      updated[editingIndex] = finalRule;
      onChange(updated);
    }
    setDialogOpen(false);
    setEditingRule(null);
    setEditingIndex(null);
  };

  const getRuleTypeInfo = (type: string) => {
    return RULE_TYPES.find((t) => t.value === type);
  };

  const getRuleDescription = (rule: ValidationRule): string => {
    switch (rule.type) {
      case "contains":
        return `Must contain: "${rule.value}"`;
      case "excludes":
        return `Must not contain: "${rule.value}"`;
      case "minLength":
        return `Minimum ${rule.value} characters`;
      case "maxLength":
        return `Maximum ${rule.value} characters`;
      case "maxResponseTime":
        return `Response within ${rule.value}ms`;
      case "regex":
        return `Must match: ${rule.value}`;
      case "jsonSchema":
        return "Must match JSON schema";
      case "isJson":
        return "Output must be valid JSON";
      case "containsJson":
        return "Output must contain valid JSON";
      default:
        return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Validation Rules</CardTitle>
            <CardDescription>
              Define rules to validate output for all test cases
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleAddRule}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingIndex === null ? "Add Validation Rule" : "Edit Rule"}
                </DialogTitle>
                <DialogDescription>
                  Configure how to validate the output
                </DialogDescription>
              </DialogHeader>
              {editingRule && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Rule Type</Label>
                    <Select
                      value={editingRule.type}
                      onValueChange={(value) =>
                        setEditingRule({
                          ...editingRule,
                          type: value as ValidationRule["type"],
                          value:
                            value === "minLength" || value === "maxLength" || value === "maxResponseTime"
                              ? 0
                              : "",
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select rule type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editingRule.type !== "isJson" && editingRule.type !== "containsJson" && (
                    <div className="space-y-2">
                      <Label>
                        {editingRule.type === "minLength" ||
                        editingRule.type === "maxLength"
                          ? "Length"
                          : editingRule.type === "maxResponseTime"
                          ? "Time (ms)"
                          : editingRule.type === "jsonSchema"
                          ? "JSON Schema"
                          : "Value"}
                      </Label>
                      {editingRule.type === "jsonSchema" ? (
                        <Textarea
                          value={editingRule.value as string}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              value: e.target.value,
                            })
                          }
                          placeholder='{"type": "object", "required": ["field"]}'
                          rows={5}
                          className="font-mono text-sm"
                        />
                      ) : editingRule.type === "minLength" ||
                        editingRule.type === "maxLength" ||
                        editingRule.type === "maxResponseTime" ? (
                        <Input
                          type="number"
                          min={0}
                          value={editingRule.value}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              value: e.target.value,
                            })
                          }
                          placeholder={editingRule.type === "maxResponseTime" ? "e.g., 5000" : "Enter number"}
                        />
                      ) : (
                        <Input
                          value={editingRule.value as string}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              value: e.target.value,
                            })
                          }
                          placeholder={
                            editingRule.type === "regex"
                              ? "^[a-z]+$"
                              : "Text to check"
                          }
                        />
                      )}
                    </div>
                  )}

                  {(editingRule.type === "isJson" || editingRule.type === "containsJson") && (
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                      {editingRule.type === "isJson"
                        ? "Validates that the entire output is valid JSON. Supports outputs wrapped in ```json ``` code blocks."
                        : "Validates that the output contains valid JSON somewhere in the response."}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={editingRule.severity || "fail"}
                      onValueChange={(value: "fail" | "warning") =>
                        setEditingRule({
                          ...editingRule,
                          severity: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fail">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-destructive" />
                            Fail - Test fails if rule not satisfied
                          </div>
                        </SelectItem>
                        <SelectItem value="warning">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Warning - Shows warning but test passes
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Error Message (optional)</Label>
                    <Input
                      value={editingRule.message || ""}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          message: e.target.value,
                        })
                      }
                      placeholder="Custom message on validation failure"
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRule}>
                  {editingIndex === null ? "Add" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No validation rules. Output will always pass.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, index) => {
              const typeInfo = getRuleTypeInfo(rule.type);
              const Icon = typeInfo?.icon || Check;
              const isWarning = rule.severity === "warning";

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg group ${
                    isWarning
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : "bg-destructive/10 border border-destructive/20"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
                    isWarning ? "bg-amber-500/20" : "bg-destructive/20"
                  }`}>
                    {isWarning ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {typeInfo?.label || rule.type}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isWarning
                            ? "text-amber-600 bg-amber-500/20"
                            : "text-destructive bg-destructive/20"
                        }`}
                      >
                        {isWarning ? "Warning" : "Must Pass"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {rule.message || getRuleDescription(rule)}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditRule(rule, index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    {canDuplicate(rule) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDuplicateRule(rule)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteRule(index)}
                        >
                          <DeleteIcon size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
