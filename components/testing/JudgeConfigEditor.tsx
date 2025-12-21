"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Brain,
  Scale,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS } from "@/lib/llm/types";
import { DeleteIcon } from "@/components/ui/delete";

export interface JudgeCriterion {
  name: string;
  description: string;
  weight: number;
}

export interface JudgeValidationRule {
  name: string;
  description: string;
  failureMessage?: string;
  severity: "fail" | "warning";
}

export interface LLMJudgeConfig {
  enabled: boolean;
  provider?: "openai" | "anthropic" | "gemini";
  model?: string;
  criteria: JudgeCriterion[];
  validationRules?: JudgeValidationRule[];
  minScore?: number;
}

interface JudgeConfigEditorProps {
  config: LLMJudgeConfig;
  onChange: (config: LLMJudgeConfig) => void;
}

const DEFAULT_CRITERIA: JudgeCriterion[] = [
  {
    name: "Helpfulness",
    description:
      "How helpful and relevant is the response to the user's request?",
    weight: 0.4,
  },
  {
    name: "Accuracy",
    description: "Is the information provided accurate and factually correct?",
    weight: 0.3,
  },
  {
    name: "Clarity",
    description:
      "Is the response clear, well-organized, and easy to understand?",
    weight: 0.3,
  },
];

export function JudgeConfigEditor({
  config,
  onChange,
}: JudgeConfigEditorProps) {
  // Criterion dialog state
  const [editingCriterion, setEditingCriterion] =
    useState<JudgeCriterion | null>(null);
  const [criterionEditingIndex, setCriterionEditingIndex] = useState<
    number | null
  >(null);
  const [criterionDialogOpen, setCriterionDialogOpen] = useState(false);

  // Validation rule dialog state
  const [editingValidationRule, setEditingValidationRule] =
    useState<JudgeValidationRule | null>(null);
  const [validationEditingIndex, setValidationEditingIndex] = useState<
    number | null
  >(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);

  const handleToggle = (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    if (enabled && config.criteria.length === 0) {
      newConfig.criteria = [...DEFAULT_CRITERIA];
    }
    if (enabled && !config.provider) {
      newConfig.provider = "openai";
      newConfig.model = "gpt-4o-mini";
    }
    onChange(newConfig);
  };

  const handleProviderChange = (provider: "openai" | "anthropic" | "gemini") => {
    let model: string;
    switch (provider) {
      case "anthropic":
        model = "claude-haiku-4-5-20251015";
        break;
      case "gemini":
        model = "gemini-2.5-flash";
        break;
      default:
        model = "gpt-4o-mini";
    }
    onChange({ ...config, provider, model });
  };

  const handleModelChange = (model: string) => {
    onChange({ ...config, model });
  };

  // Criterion handlers
  const handleAddCriterion = () => {
    setEditingCriterion({
      name: "",
      description: "",
      weight: 0.33,
    });
    setCriterionEditingIndex(null);
    setCriterionDialogOpen(true);
  };

  const handleEditCriterion = (criterion: JudgeCriterion, index: number) => {
    setEditingCriterion({ ...criterion });
    setCriterionEditingIndex(index);
    setCriterionDialogOpen(true);
  };

  const handleDeleteCriterion = (index: number) => {
    const updated = config.criteria.filter((_, i) => i !== index);
    onChange({ ...config, criteria: updated });
  };

  const handleSaveCriterion = () => {
    if (!editingCriterion) return;

    const criteria = [...config.criteria];
    if (criterionEditingIndex === null) {
      criteria.push(editingCriterion);
    } else {
      criteria[criterionEditingIndex] = editingCriterion;
    }
    onChange({ ...config, criteria });
    setCriterionDialogOpen(false);
    setEditingCriterion(null);
    setCriterionEditingIndex(null);
  };

  // Validation rule handlers
  const handleAddValidationRule = () => {
    setEditingValidationRule({
      name: "",
      description: "",
      failureMessage: "",
      severity: "fail",
    });
    setValidationEditingIndex(null);
    setValidationDialogOpen(true);
  };

  const handleEditValidationRule = (
    rule: JudgeValidationRule,
    index: number
  ) => {
    setEditingValidationRule({ ...rule });
    setValidationEditingIndex(index);
    setValidationDialogOpen(true);
  };

  const handleDeleteValidationRule = (index: number) => {
    const updated = (config.validationRules || []).filter(
      (_, i) => i !== index
    );
    onChange({ ...config, validationRules: updated });
  };

  const handleSaveValidationRule = () => {
    if (!editingValidationRule) return;

    const validationRules = [...(config.validationRules || [])];
    if (validationEditingIndex === null) {
      validationRules.push(editingValidationRule);
    } else {
      validationRules[validationEditingIndex] = editingValidationRule;
    }
    onChange({ ...config, validationRules });
    setValidationDialogOpen(false);
    setEditingValidationRule(null);
    setValidationEditingIndex(null);
  };

  const totalWeight = config.criteria.reduce((sum, c) => sum + c.weight, 0);
  const weightsValid = Math.abs(totalWeight - 1) < 0.01;

  const models =
    config.provider === "anthropic"
      ? ANTHROPIC_MODELS
      : config.provider === "gemini"
        ? GEMINI_MODELS
        : OPENAI_MODELS;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">LLM Judge</CardTitle>
              <CardDescription>
                Use AI to evaluate response quality
              </CardDescription>
            </div>
          </div>
          <Switch checked={config.enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>
      {config.enabled && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={config.provider || "openai"}
                onValueChange={(v) =>
                  handleProviderChange(v as "openai" | "anthropic" | "gemini")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={config.model || models[0]}
                onValueChange={handleModelChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Minimum Score Threshold */}
          <div className="space-y-2">
            <Label>Minimum Score Threshold</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={config.minScore !== undefined ? Math.round(config.minScore * 100) : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    onChange({ ...config, minScore: undefined });
                  } else {
                    const percent = Math.min(100, Math.max(0, parseInt(value) || 0));
                    onChange({ ...config, minScore: percent / 100 });
                  }
                }}
                placeholder="Not set"
                className="w-24 min-w-[80px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
              {config.minScore !== undefined && config.minScore > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ ...config, minScore: undefined })}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Test fails if the judge score is below this threshold. Leave empty to disable.
            </p>
          </div>

          {/* Evaluation Criteria Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Evaluation Criteria
                </Label>
                <p className="text-xs text-muted-foreground">
                  Scoring criteria contribute to the overall quality score.
                  Weights determine importance.
                </p>
              </div>
              <Dialog
                open={criterionDialogOpen}
                onOpenChange={setCriterionDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCriterion}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Criterion
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {criterionEditingIndex === null
                        ? "Add Criterion"
                        : "Edit Criterion"}
                    </DialogTitle>
                    <DialogDescription>
                      Define what the judge should evaluate and score
                    </DialogDescription>
                  </DialogHeader>
                  {editingCriterion && (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editingCriterion.name}
                          onChange={(e) =>
                            setEditingCriterion({
                              ...editingCriterion,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g., Helpfulness"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={editingCriterion.description}
                          onChange={(e) =>
                            setEditingCriterion({
                              ...editingCriterion,
                              description: e.target.value,
                            })
                          }
                          placeholder="What should the judge evaluate?"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weight (0-1)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={editingCriterion.weight}
                          onChange={(e) =>
                            setEditingCriterion({
                              ...editingCriterion,
                              weight: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Weights should sum to 1.0 across all criteria.
                        </p>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCriterionDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCriterion}>
                      {criterionEditingIndex === null ? "Add" : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {config.criteria.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                No criteria defined. Add criteria for the judge to score.
              </div>
            ) : (
              <div className="space-y-2">
                {config.criteria.map((criterion, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                  >
                    <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {criterion.name}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {(criterion.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {criterion.description}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditCriterion(criterion, index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteCriterion(index)}
                      >
                        <DeleteIcon size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!weightsValid && (
                  <p className="text-xs text-amber-500">
                    Warning: Weights sum to {(totalWeight * 100).toFixed(0)}%
                    (should be 100%)
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Validation Rules Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Validation Rules
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pass/fail gates that must be satisfied. If any rule fails, the
                  test fails regardless of score.
                </p>
              </div>
              <Dialog
                open={validationDialogOpen}
                onOpenChange={setValidationDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddValidationRule}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>
                      {validationEditingIndex === null
                        ? "Add Validation Rule"
                        : "Edit Validation Rule"}
                    </DialogTitle>
                    <DialogDescription>
                      Define a requirement the response must satisfy to pass
                    </DialogDescription>
                  </DialogHeader>
                  {editingValidationRule && (
                    <div className="space-y-4 py-4 overflow-y-auto flex-1">
                      <div className="space-y-2">
                        <Label>Rule Name</Label>
                        <Input
                          value={editingValidationRule.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            const updates: Partial<JudgeValidationRule> = {
                              name: newName,
                            };
                            // Auto-fill failure message if empty
                            if (!editingValidationRule.failureMessage?.trim()) {
                              updates.failureMessage = newName ? `${newName} failed` : "";
                            }
                            setEditingValidationRule({
                              ...editingValidationRule,
                              ...updates,
                            });
                          }}
                          placeholder="e.g., No harmful content"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={editingValidationRule.description}
                          onChange={(e) =>
                            setEditingValidationRule({
                              ...editingValidationRule,
                              description: e.target.value,
                            })
                          }
                          placeholder="Describe what the judge should check. Be specific about what constitutes a pass or fail."
                          rows={4}
                          className="min-h-[100px] max-h-[200px] resize-y"
                        />
                        <p className="text-xs text-muted-foreground">
                          The judge will evaluate if the response satisfies this
                          requirement and return pass/fail.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select
                          value={editingValidationRule.severity || "fail"}
                          onValueChange={(value: "fail" | "warning") =>
                            setEditingValidationRule({
                              ...editingValidationRule,
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
                        <Label>Failure Message (optional)</Label>
                        <Input
                          value={editingValidationRule.failureMessage || ""}
                          onChange={(e) =>
                            setEditingValidationRule({
                              ...editingValidationRule,
                              failureMessage: e.target.value,
                            })
                          }
                          placeholder="e.g., Response contains prohibited content"
                        />
                        <p className="text-xs text-muted-foreground">
                          Message shown when this rule fails.
                        </p>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setValidationDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveValidationRule}>
                      {validationEditingIndex === null ? "Add" : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {(!config.validationRules || config.validationRules.length === 0) ? (
              <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                <p>No validation rules defined.</p>
                <p className="text-xs mt-1">
                  Add rules to enforce strict requirements (e.g., no PII, must
                  include disclaimer).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {config.validationRules.map((rule, index) => {
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
                      {isWarning ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rule.name}</span>
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
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {rule.description}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditValidationRule(rule, index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteValidationRule(index)}
                        >
                          <DeleteIcon size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </CardContent>
      )}
    </Card>
  );
}
