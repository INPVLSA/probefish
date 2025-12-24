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
import { Plus, Pencil, GripVertical, Copy, X, Play, Loader2, Pause, CirclePlay } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export interface TestCase {
  _id?: string;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
  tags?: string[];
  enabled?: boolean;
}

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
        isEnabled
          ? "bg-muted/50 hover:bg-muted"
          : "bg-muted/20 opacity-60"
      }`}
      onClick={() => onEdit(testCase, index)}
    >
      {onSelectionChange && testCase._id && (
        <Checkbox
          checked={selectedCaseIds.includes(testCase._id)}
          onCheckedChange={(checked) => onToggle(testCase._id!, !!checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${testCase.name}`}
          disabled={!isEnabled}
        />
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
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        {onRunSingleCase && testCase._id && (
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
}: TestCaseEditorProps) {
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Collect all unique tags from existing test cases for autocomplete
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    testCases.forEach((tc) => tc.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [testCases]);

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

    if (editingIndex === null) {
      onChange([...testCases, editingCase]);
    } else {
      const updated = [...testCases];
      updated[editingIndex] = editingCase;
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

  // Selection helpers
  const selectableCases = testCases.filter((tc) => tc._id);
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
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(selectableCases.map((tc) => tc._id!));
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
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingIndex === null ? "Add Test Case" : "Edit Test Case"}
                </DialogTitle>
                <DialogDescription>
                  Define inputs for this test case
                </DialogDescription>
              </DialogHeader>
              {editingCase && (
                <div className="space-y-4 py-4">
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

                  {variables.length > 0 ? (
                    <div className="space-y-3">
                      <Label>Variables</Label>
                      {variables.map((varName) => {
                        const value = editingCase.inputs[varName] || "";
                        const useTextarea = value.length > 80 || value.includes("\n");
                        return (
                          <div key={varName} className="space-y-1">
                            <Label
                              htmlFor={`var-${varName}`}
                              className="text-sm text-muted-foreground"
                            >
                              {`{{${varName}}}`}
                            </Label>
                            {useTextarea ? (
                              <Textarea
                                id={`var-${varName}`}
                                value={value}
                                onChange={(e) =>
                                  updateEditingInput(varName, e.target.value)
                                }
                                placeholder={`Value for ${varName}`}
                                rows={3}
                                className="max-h-40 resize-y"
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

                  <div className="space-y-2">
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
                        size="sm"
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCase}>
                  {editingIndex === null ? "Add" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {testCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No test cases yet.</p>
            <p className="text-sm">Add test cases to run tests.</p>
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
