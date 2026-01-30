"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, GripVertical, Copy, X, Play, Loader2, Pause, CirclePlay, Braces, Check, AlertCircle, FileText, ShieldCheck, MessageSquare, MessagesSquare, Search, Tag, ChevronDown } from "lucide-react";
import { ValidationRule, ValidationRulesEditor } from "./ValidationRulesEditor";
import { ConversationEditor, ConversationTurn, ValidationTimingMode } from "./ConversationEditor";
import { SessionConfigEditor, SessionConfig } from "./SessionConfigEditor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteIcon } from "@/components/ui/delete";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Judge validation rule for per-case config
interface JudgeValidationRule {
  name: string;
  description: string;
  failureMessage?: string;
  severity: "fail" | "warning";
}

export interface TestCase {
  _id?: string;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
  enabled?: boolean;
  // Per-case validation configuration
  validationMode?: "text" | "rules";
  validationRules?: ValidationRule[];
  judgeValidationRules?: JudgeValidationRule[];
  // Multi-message conversation support
  isConversation?: boolean;
  conversation?: ConversationTurn[];
  validationTiming?: ValidationTimingMode;
  sessionConfig?: SessionConfig;
}

// Helper function to determine effective validation mode
function getEffectiveMode(testCase: TestCase): "text" | "rules" {
  if (testCase.validationMode) return testCase.validationMode;
  // Legacy detection: if expectedOutput exists, use text mode
  if (testCase.expectedOutput?.trim()) return "text";
  // Default for new test cases: rules mode
  return "rules";
}

// JSON helper functions
const isLikelyJson = (value: string): boolean => {
  const trimmed = value.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
         (trimmed.startsWith("[") && trimmed.endsWith("]"));
};

const tryParseJson = (value: string): { valid: boolean; formatted?: string } => {
  try {
    const parsed = JSON.parse(value);
    return { valid: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { valid: false };
  };
};

const formatJsonIfValid = (value: string): string => {
  const result = tryParseJson(value);
  return result.formatted || value;
};

interface TestCaseEditorProps {
  testCases: TestCase[];
  variables: string[];
  onChange: (testCases: TestCase[]) => void;
  // Selection and run props
  selectedCaseIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRunSingleCase?: (testCaseId: string) => void;
  onRunSelectedCases?: () => void;
  running?: boolean;
  runningCaseId?: string | null;
  // Target type for conversation mode
  targetType?: "prompt" | "endpoint";
}

// Sortable row component
interface SortableTestCaseRowProps {
  testCase: TestCase;
  index: number;
  selectedCaseIds: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRunSingleCase?: (testCaseId: string) => void;
  running: boolean;
  runningCaseId: string | null;
  onEdit: (testCase: TestCase, index: number) => void;
  onDuplicate: (testCase: TestCase) => void;
  onDelete: (index: number) => void;
  onToggle: (testCaseId: string, checked: boolean) => void;
  onToggleEnabled: (index: number) => void;
}

function SortableTestCaseRow({
  testCase,
  index,
  selectedCaseIds,
  onSelectionChange,
  onRunSingleCase,
  running,
  runningCaseId,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onToggleEnabled,
}: SortableTestCaseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testCase._id || `temp-${index}` });

  const isEnabled = testCase.enabled !== false;
  const isRunning = runningCaseId === testCase._id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg group cursor-pointer transition-colors ${
        isRunning
          ? "bg-muted ring-1 ring-primary/40 animate-pulse"
          : isEnabled
            ? "bg-muted/50 hover:bg-muted"
            : "bg-muted/20 opacity-60"
      }`}
      onClick={() => onEdit(testCase, index)}
    >
      {onSelectionChange && (
        testCase._id ? (
          <Checkbox
            checked={selectedCaseIds.includes(testCase._id)}
            onCheckedChange={(checked) => onToggle(testCase._id!, !!checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${testCase.name}`}
            disabled={!isEnabled}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={false}
                  disabled
                  aria-label="Save suite to enable selection"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>Save suite to enable selection</TooltipContent>
          </Tooltip>
        )
      )}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium truncate ${!isEnabled ? "line-through text-muted-foreground" : ""}`}>
            {testCase.name}
          </span>
          {!isEnabled && (
            <Badge variant="outline" className="text-xs py-0 px-1.5 text-muted-foreground">
              Suspended
            </Badge>
          )}
          {testCase.tags && testCase.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {testCase.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs py-0 px-1.5">
                  {tag}
                </Badge>
              ))}
              {testCase.tags.length > 3 && (
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  +{testCase.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {Object.entries(testCase.inputs)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: "${v}"`)
            .join(", ") || "No inputs"}
        </div>
        {testCase.expectedOutput && (
          <div className="text-xs text-muted-foreground truncate mt-1 italic">
            Expected: {testCase.expectedOutput}
          </div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onToggleEnabled(index); }}
            >
              {isEnabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <CirclePlay className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isEnabled ? "Suspend test case" : "Resume test case"}</TooltipContent>
        </Tooltip>
        {onRunSingleCase && (
          testCase._id ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); onRunSingleCase(testCase._id!); }}
                  disabled={running || !isEnabled}
                >
                  {runningCaseId === testCase._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run this test case</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Save suite to run</TooltipContent>
            </Tooltip>
          )
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onEdit(testCase, index); }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onDuplicate(testCase); }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(index); }}
            >
              <DeleteIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function TestCaseEditor({
  testCases,
  variables,
  onChange,
  selectedCaseIds = [],
  onSelectionChange,
  onRunSingleCase,
  onRunSelectedCases,
  running = false,
  runningCaseId = null,
  targetType = "prompt",
}: TestCaseEditorProps) {
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "suspended">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Collect all unique tags from existing test cases for autocomplete
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    testCases.forEach((tc) => tc.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [testCases]);

  // Filter test cases based on search query, status, and tags
  const filteredTestCases = useMemo(() => {
    let filtered = [...testCases];

    // Apply status filter
    if (statusFilter === "enabled") {
      filtered = filtered.filter((tc) => tc.enabled !== false);
    } else if (statusFilter === "suspended") {
      filtered = filtered.filter((tc) => tc.enabled === false);
    }

    // Apply tag filter (show cases with ANY selected tag)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((tc) =>
        tc.tags?.some((tag) => selectedTags.includes(tag))
      );
    }

    // Apply text search across all fields
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tc) => {
        if (tc.name.toLowerCase().includes(query)) return true;
        if (tc.tags?.some((tag) => tag.toLowerCase().includes(query))) return true;
        if (Object.values(tc.inputs).join(" ").toLowerCase().includes(query)) return true;
        if (tc.expectedOutput?.toLowerCase().includes(query)) return true;
        if (tc.notes?.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    return filtered;
  }, [testCases, searchQuery, statusFilter, selectedTags]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter !== "all" || selectedTags.length > 0;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedTags([]);
  };

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag || !editingCase) return;
    if (editingCase.tags?.includes(normalizedTag)) return;

    setEditingCase({
      ...editingCase,
      tags: [...(editingCase.tags || []), normalizedTag],
    });
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!editingCase) return;
    setEditingCase({
      ...editingCase,
      tags: editingCase.tags?.filter((t) => t !== tagToRemove) || [],
    });
  };

  const handleAddCase = () => {
    const newCase: TestCase = {
      name: `Test Case ${testCases.length + 1}`,
      inputs: variables.reduce((acc, v) => ({ ...acc, [v]: "" }), {}),
      expectedOutput: "",
      notes: "",
      tags: [],
    };
    setEditingCase(newCase);
    setEditingIndex(null);
    setTagInput("");
    setValidationError(null);
    setDialogOpen(true);
  };

  const handleEditCase = (testCase: TestCase, index: number) => {
    // Ensure all variables are in inputs
    const inputs = { ...testCase.inputs };
    for (const v of variables) {
      if (!(v in inputs)) {
        inputs[v] = "";
      }
    }
    setEditingCase({ ...testCase, inputs, tags: testCase.tags || [] });
    setEditingIndex(index);
    setTagInput("");
    setValidationError(null);
    setDialogOpen(true);
  };

  const handleDeleteCase = (index: number) => {
    const updated = testCases.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleDuplicateCase = (testCase: TestCase) => {
    const duplicatedCase: TestCase = {
      ...testCase,
      _id: undefined, // Remove _id so it gets a new one when saved
      name: `${testCase.name} (copy)`,
      tags: [...(testCase.tags || [])], // Copy tags
    };
    onChange([...testCases, duplicatedCase]);
  };

  const handleToggleEnabled = (index: number) => {
    const updated = [...testCases];
    updated[index] = {
      ...updated[index],
      enabled: updated[index].enabled === false ? true : false,
    };
    onChange(updated);
  };

  const handleSaveCase = () => {
    if (!editingCase) return;

    let caseToSave = editingCase;

    // Process conversation turns if in conversation mode
    if (editingCase.isConversation && editingCase.conversation?.length) {
      // For prompts: validate content is not empty
      // For endpoints: auto-generate content from inputs if empty
      if (targetType === "prompt") {
        const emptyTurns = editingCase.conversation
          .map((turn, index) => ({ turn, index }))
          .filter(({ turn }) => !turn.content.trim());

        if (emptyTurns.length > 0) {
          const turnNumbers = emptyTurns.map(({ index }) => index + 1).join(", ");
          setValidationError(
            `Turn${emptyTurns.length > 1 ? "s" : ""} ${turnNumbers} ${emptyTurns.length > 1 ? "have" : "has"} empty content. All conversation turns require content.`
          );
          return;
        }
      } else {
        // Endpoint: auto-generate content from inputs for user turns with empty content
        const processedConversation = editingCase.conversation.map((turn, index) => {
          if (turn.role === "user" && !turn.content.trim()) {
            // Generate content from inputs
            const inputValues = Object.entries(turn.inputs || {})
              .filter(([, value]) => value.trim())
              .map(([, value]) => value.trim());

            const generatedContent = inputValues.length > 0
              ? inputValues[0] // Use first non-empty input value
              : `Turn ${index + 1}`; // Fallback label

            return { ...turn, content: generatedContent };
          }
          return turn;
        });

        caseToSave = { ...editingCase, conversation: processedConversation };
      }
    }

    setValidationError(null);

    if (editingIndex === null) {
      onChange([...testCases, caseToSave]);
    } else {
      const updated = [...testCases];
      updated[editingIndex] = caseToSave;
      onChange(updated);
    }
    setDialogOpen(false);
    setEditingCase(null);
    setEditingIndex(null);
  };

  const updateEditingInput = (key: string, value: string) => {
    if (!editingCase) return;
    setEditingCase({
      ...editingCase,
      inputs: { ...editingCase.inputs, [key]: value },
    });
  };

  // Selection helpers - use filtered cases when filters are active
  const selectableCases = filteredTestCases.filter((tc) => tc._id && tc.enabled !== false);
  const allSelected = selectableCases.length > 0 && selectableCases.every((tc) => selectedCaseIds.includes(tc._id!));
  const someSelected = selectedCaseIds.length > 0;

  const handleToggleCase = (testCaseId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedCaseIds, testCaseId]);
    } else {
      onSelectionChange(selectedCaseIds.filter((id) => id !== testCaseId));
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    const visibleIds = selectableCases.map((tc) => tc._id!);
    if (allSelected) {
      // Deselect all visible cases (keep selections from other filters)
      onSelectionChange(selectedCaseIds.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible cases (add to existing selections)
      const newSelection = new Set([...selectedCaseIds, ...visibleIds]);
      onSelectionChange(Array.from(newSelection));
    }
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = testCases.findIndex(
        (tc, idx) => (tc._id || `temp-${idx}`) === active.id
      );
      const newIndex = testCases.findIndex(
        (tc, idx) => (tc._id || `temp-${idx}`) === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(testCases, oldIndex, newIndex));
      }
    }
  };

  // Generate stable IDs for sortable context
  const sortableIds = testCases.map((tc, idx) => tc._id || `temp-${idx}`);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onSelectionChange && testCases.length > 0 && (
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all test cases"
              />
            )}
            <div>
              <CardTitle className="text-lg">Test Cases</CardTitle>
              <CardDescription>
                Define test cases with variable values
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {someSelected && onRunSelectedCases && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRunSelectedCases}
                disabled={running}
              >
                {running && !runningCaseId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Selected ({selectedCaseIds.length})
                  </>
                )}
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleAddCase}>
                <Plus className="mr-2 h-4 w-4" />
                Add Test Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              {editingCase && (
                <div className="space-y-4 overflow-y-auto flex-1 -mr-4 pr-4 scrollbar-light">
                  <DialogHeader>
                    <DialogTitle>
                      {editingIndex === null ? "Add Test Case" : "Edit Test Case"}
                    </DialogTitle>
                    <DialogDescription>
                      Define inputs for this test case
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="case-name">Name</Label>
                    <Input
                      id="case-name"
                      value={editingCase.name}
                      onChange={(e) =>
                        setEditingCase({ ...editingCase, name: e.target.value })
                      }
                      placeholder="Test case name"
                    />
                  </div>

                  {/* Test Mode Toggle */}
                  <div className="space-y-2">
                    <Label>Test Mode</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!editingCase.isConversation ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingCase({ ...editingCase, isConversation: false })}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Single Turn
                      </Button>
                      <Button
                        type="button"
                        variant={editingCase.isConversation ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingCase({
                          ...editingCase,
                          isConversation: true,
                          conversation: editingCase.conversation || [{ role: "user", content: "" }],
                          validationTiming: editingCase.validationTiming || "final-only",
                        })}
                      >
                        <MessagesSquare className="mr-2 h-4 w-4" />
                        Conversation
                      </Button>
                    </div>
                  </div>

                  {/* Conversation Editor (when in conversation mode) */}
                  {editingCase.isConversation ? (
                    <div className="space-y-4">
                      {/* Variables section for conversation mode */}
                      {variables.length > 0 && (
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                          <Label className="text-sm font-medium">Default Variable Values</Label>
                          <p className="text-xs text-muted-foreground">
                            Set default values for variables. These can be overridden per-turn below.
                          </p>
                          <div className="grid gap-3">
                            {variables.map((varName) => {
                              const value = editingCase.inputs[varName] || "";
                              const looksLikeJson = isLikelyJson(value);
                              const jsonStatus = looksLikeJson ? tryParseJson(value) : null;
                              const useTextarea = value.length > 80 || value.includes("\n") || looksLikeJson;

                              return (
                                <div key={varName} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Label
                                      htmlFor={`conv-var-${varName}`}
                                      className="text-sm text-muted-foreground"
                                    >
                                      {`{{${varName}}}`}
                                    </Label>
                                    {looksLikeJson && jsonStatus && (
                                      <div className="flex items-center gap-1.5">
                                        {jsonStatus.valid ? (
                                          <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1 text-green-600 border-green-300">
                                            <Check className="h-3 w-3" />
                                            JSON
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1 text-amber-600 border-amber-300">
                                            <AlertCircle className="h-3 w-3" />
                                            JSON
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {useTextarea ? (
                                    <Textarea
                                      id={`conv-var-${varName}`}
                                      value={value}
                                      onChange={(e) => updateEditingInput(varName, e.target.value)}
                                      placeholder={`Value for ${varName}`}
                                      rows={looksLikeJson ? 4 : 2}
                                      className={`max-h-40 resize-y ${looksLikeJson ? "font-mono text-sm" : ""}`}
                                    />
                                  ) : (
                                    <Input
                                      id={`conv-var-${varName}`}
                                      value={value}
                                      onChange={(e) => updateEditingInput(varName, e.target.value)}
                                      placeholder={`Value for ${varName}`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <ConversationEditor
                        turns={editingCase.conversation || []}
                        variables={variables}
                        onChange={(turns) => setEditingCase({ ...editingCase, conversation: turns })}
                        validationTiming={editingCase.validationTiming || "final-only"}
                        onValidationTimingChange={(timing) => setEditingCase({ ...editingCase, validationTiming: timing })}
                        targetType={targetType}
                      />

                      {/* Session Config for endpoints */}
                      {targetType === "endpoint" && (
                        <SessionConfigEditor
                          config={editingCase.sessionConfig}
                          onChange={(config) => setEditingCase({ ...editingCase, sessionConfig: config })}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                  {variables.length > 0 ? (
                    <div className="space-y-3">
                      <Label>Variables</Label>
                      {variables.map((varName) => {
                        const value = editingCase.inputs[varName] || "";
                        const looksLikeJson = isLikelyJson(value);
                        const jsonStatus = looksLikeJson ? tryParseJson(value) : null;
                        const useTextarea = value.length > 80 || value.includes("\n") || looksLikeJson;

                        return (
                          <div key={varName} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`var-${varName}`}
                                className="text-sm text-muted-foreground"
                              >
                                {`{{${varName}}}`}
                              </Label>
                              {looksLikeJson && (
                                <div className="flex items-center gap-1.5">
                                  {jsonStatus?.valid ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1 text-green-600 border-green-300">
                                          <Check className="h-3 w-3" />
                                          JSON
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>Valid JSON</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1 text-amber-600 border-amber-300">
                                          <AlertCircle className="h-3 w-3" />
                                          JSON
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>Invalid JSON syntax</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {jsonStatus?.valid && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => updateEditingInput(varName, formatJsonIfValid(value))}
                                        >
                                          <Braces className="h-3 w-3 mr-1" />
                                          Format
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Format JSON</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </div>
                            {useTextarea ? (
                              <Textarea
                                id={`var-${varName}`}
                                value={value}
                                onChange={(e) =>
                                  updateEditingInput(varName, e.target.value)
                                }
                                placeholder={`Value for ${varName}`}
                                rows={looksLikeJson ? 6 : 3}
                                className={`max-h-60 resize-y ${looksLikeJson ? "font-mono text-sm" : ""}`}
                              />
                            ) : (
                              <Input
                                id={`var-${varName}`}
                                value={value}
                                onChange={(e) =>
                                  updateEditingInput(varName, e.target.value)
                                }
                                placeholder={`Value for ${varName}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No variables detected. Add variables to your prompt/endpoint
                      using {"{{variable}}"} syntax.
                    </p>
                  )}

                  {/* Validation Mode Toggle */}
                  <div className="space-y-2">
                    <Label>Validation</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={getEffectiveMode(editingCase) === "text" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingCase({ ...editingCase, validationMode: "text" })}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Expected Output
                      </Button>
                      <Button
                        type="button"
                        variant={getEffectiveMode(editingCase) === "rules" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingCase({ ...editingCase, validationMode: "rules" })}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Validation Rules
                      </Button>
                    </div>
                  </div>

                  {/* Conditional Content based on mode */}
                  {getEffectiveMode(editingCase) === "text" ? (
                    <div className="space-y-2">
                      <Label htmlFor="expected-output">
                        Expected Output (optional)
                      </Label>
                      <Textarea
                        id="expected-output"
                        value={editingCase.expectedOutput || ""}
                        onChange={(e) =>
                          setEditingCase({
                            ...editingCase,
                            expectedOutput: e.target.value,
                          })
                        }
                        placeholder="What output do you expect? (used by LLM judge)"
                        rows={3}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Per-Case Validation Rules</Label>
                        {(editingCase.validationRules?.length || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {editingCase.validationRules?.length} rule{editingCase.validationRules?.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Added to suite-level rules (both are checked)
                      </p>
                      <div className="border rounded-lg p-3 bg-muted/30">
                        <ValidationRulesEditor
                          rules={editingCase.validationRules || []}
                          onChange={(rules) => setEditingCase({ ...editingCase, validationRules: rules })}
                          compact
                        />
                      </div>
                    </div>
                  )}
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={editingCase.notes || ""}
                      onChange={(e) =>
                        setEditingCase({
                          ...editingCase,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Any notes about this test case"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2 pb-2">
                    <Label>Tags (optional)</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {editingCase.tags?.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="pl-2 pr-1 py-0.5 gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="tag-input"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag(tagInput);
                          }
                        }}
                        placeholder="Add a tag..."
                        list="tag-suggestions"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAddTag(tagInput)}
                        disabled={!tagInput.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    {allTags.length > 0 && (
                      <datalist id="tag-suggestions">
                        {allTags
                          .filter((t) => !editingCase.tags?.includes(t))
                          .map((tag) => (
                            <option key={tag} value={tag} />
                          ))}
                      </datalist>
                    )}
                    {allTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground mr-1">Existing:</span>
                        {allTags
                          .filter((t) => !editingCase.tags?.includes(t))
                          .slice(0, 8)
                          .map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs cursor-pointer hover:bg-muted"
                              onClick={() => handleAddTag(tag)}
                            >
                              + {tag}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-4 -mt-2 flex-shrink-0">
                {validationError && (
                  <div className="flex items-center gap-2 text-destructive text-sm mr-auto">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCase}>
                    {editingIndex === null ? "Add" : "Save"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filter Controls */}
        {testCases.length > 0 && (
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Text search input */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search test cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Status filter dropdown */}
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {/* Tag filter - multi-select with popover */}
              {allTags.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-between">
                      <Tag className="mr-2 h-4 w-4" />
                      {selectedTags.length > 0 ? (
                        <span>{selectedTags.length} tag{selectedTags.length !== 1 ? "s" : ""}</span>
                      ) : (
                        <span>Filter by tags</span>
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-2">
                      {allTags.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-tag-${tag}`}
                            checked={selectedTags.includes(tag)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTags([...selectedTags, tag]);
                              } else {
                                setSelectedTags(selectedTags.filter((t) => t !== tag));
                              }
                            }}
                          />
                          <label
                            htmlFor={`filter-tag-${tag}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {tag}
                          </label>
                        </div>
                      ))}
                      {selectedTags.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setSelectedTags([])}
                        >
                          Clear tags
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Results count indicator */}
            {hasActiveFilters && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredTestCases.length} of {testCases.length} test case{testCases.length !== 1 ? "s" : ""}
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs px-1 h-auto"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {testCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No test cases yet.</p>
            <p className="text-sm">Add test cases to run tests.</p>
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No test cases match the current filters.</p>
            <p className="text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : hasActiveFilters ? (
          // Render without drag-and-drop when filters are active
          <div className="space-y-2">
            {filteredTestCases.map((testCase) => {
              const originalIndex = testCases.findIndex(tc =>
                tc._id === testCase._id || (tc._id === undefined && tc.name === testCase.name && JSON.stringify(tc.inputs) === JSON.stringify(testCase.inputs))
              );
              return (
                <SortableTestCaseRow
                  key={testCase._id || `temp-${originalIndex}`}
                  testCase={testCase}
                  index={originalIndex}
                  selectedCaseIds={selectedCaseIds}
                  onSelectionChange={onSelectionChange}
                  onRunSingleCase={onRunSingleCase}
                  running={running}
                  runningCaseId={runningCaseId}
                  onEdit={handleEditCase}
                  onDuplicate={handleDuplicateCase}
                  onDelete={handleDeleteCase}
                  onToggle={handleToggleCase}
                  onToggleEnabled={handleToggleEnabled}
                />
              );
            })}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {testCases.map((testCase, index) => (
                  <SortableTestCaseRow
                    key={testCase._id || `temp-${index}`}
                    testCase={testCase}
                    index={index}
                    selectedCaseIds={selectedCaseIds}
                    onSelectionChange={onSelectionChange}
                    onRunSingleCase={onRunSingleCase}
                    running={running}
                    runningCaseId={runningCaseId}
                    onEdit={handleEditCase}
                    onDuplicate={handleDuplicateCase}
                    onDelete={handleDeleteCase}
                    onToggle={handleToggleCase}
                    onToggleEnabled={handleToggleEnabled}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
