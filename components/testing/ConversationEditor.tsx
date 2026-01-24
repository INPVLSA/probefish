"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  GripVertical,
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Trash2,
} from "lucide-react";
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
import { ValidationRule, ValidationRulesEditor } from "./ValidationRulesEditor";
import { cn } from "@/lib/utils";

// Conversation turn interface (matching the model)
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  inputs?: Record<string, string>;  // Per-turn variable values
  simulatedResponse?: string;
  expectedOutput?: string;
  validationRules?: ValidationRule[];
  judgeValidationRules?: {
    name: string;
    description: string;
    failureMessage?: string;
    severity: "fail" | "warning";
  }[];
}

export type ValidationTimingMode = "per-turn" | "final-only";

interface ConversationEditorProps {
  turns: ConversationTurn[];
  variables: string[];
  onChange: (turns: ConversationTurn[]) => void;
  validationTiming: ValidationTimingMode;
  onValidationTimingChange: (mode: ValidationTimingMode) => void;
  targetType: "prompt" | "endpoint";
}

// Sortable turn component
interface SortableTurnProps {
  turn: ConversationTurn;
  index: number;
  variables: string[];
  validationTiming: ValidationTimingMode;
  targetType: "prompt" | "endpoint";
  onUpdate: (index: number, turn: ConversationTurn) => void;
  onDelete: (index: number) => void;
}

function SortableTurn({
  turn,
  index,
  variables,
  validationTiming,
  targetType,
  onUpdate,
  onDelete,
}: SortableTurnProps) {
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `turn-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isUser = turn.role === "user";
  const hasValidationRules = (turn.validationRules?.length ?? 0) > 0;
  const hasJudgeRules = (turn.judgeValidationRules?.length ?? 0) > 0;
  const hasAnyValidation = hasValidationRules || hasJudgeRules;
  const isEmpty = !turn.content.trim();

  // Highlight variables in content
  const highlightVariables = (content: string) => {
    const parts = content.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        const varName = part.slice(2, -2).trim();
        const isKnown = variables.includes(varName);
        return (
          <Badge
            key={i}
            variant={isKnown ? "secondary" : "destructive"}
            className="mx-0.5 font-mono text-xs"
          >
            {varName}
          </Badge>
        );
      }
      return part;
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group flex gap-2 mb-3",
        isUser ? "flex-row mr-3" : "flex-row-reverse ml-3"
      )}
    >
      {/* Avatar / Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center cursor-grab transition-colors",
          isUser
            ? "bg-primary/10 text-primary group-hover:bg-transparent group-hover:text-muted-foreground"
            : "bg-muted text-muted-foreground group-hover:bg-transparent"
        )}
      >
        <span className="group-hover:hidden">
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <GripVertical className="h-4 w-4 hidden group-hover:block" />
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "relative flex-1 max-w-[85%] rounded-lg p-3 border",
          isUser ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-muted"
        )}
      >
        {/* Delete button - absolute positioned */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-destructive hover:text-destructive/80"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete turn</TooltipContent>
        </Tooltip>

        {/* Role label and validation indicator */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? "User" : "Assistant"}
            {!isUser && targetType === "prompt" && (
              <span className="ml-1 text-muted-foreground/60">(simulated)</span>
            )}
          </span>
          {hasAnyValidation && validationTiming === "per-turn" && (
            <Tooltip>
              <TooltipTrigger>
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Has per-turn validation</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ENDPOINTS: User turns - show only variable inputs */}
        {targetType === "endpoint" && isUser && (
          <>
            {variables.length > 0 ? (
              <div className="space-y-2">
                {variables.map((varName) => (
                  <Input
                    key={varName}
                    value={turn.inputs?.[varName] || ""}
                    onChange={(e) =>
                      onUpdate(index, {
                        ...turn,
                        inputs: { ...(turn.inputs || {}), [varName]: e.target.value },
                      })
                    }
                    placeholder={`{{${varName}}}`}
                    className="h-9 text-sm"
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No variables defined. Add variables to endpoint body template using {"{{variable}}"} syntax.
              </p>
            )}
          </>
        )}

        {/* ENDPOINTS: Assistant turns - optional simulated response */}
        {targetType === "endpoint" && !isUser && (
          <Textarea
            value={turn.content}
            onChange={(e) => onUpdate(index, { ...turn, content: e.target.value })}
            placeholder="Enter expected response pattern (optional)"
            className="min-h-[60px] resize-y text-sm"
          />
        )}

        {/* PROMPTS: Content is the primary input */}
        {targetType === "prompt" && (
          <>
            <Textarea
              value={turn.content}
              onChange={(e) => onUpdate(index, { ...turn, content: e.target.value })}
              placeholder={
                isUser
                  ? "Enter user message... (use {{variable}} for substitution)"
                  : "Enter simulated assistant response (optional, for context setup)"
              }
              className={cn(
                "min-h-[60px] resize-y text-sm",
                isUser && isEmpty && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {isUser && isEmpty && (
              <p className="text-xs text-destructive mt-1">Content is required</p>
            )}

            {/* Variable inputs for prompts (for substitution in content) */}
            {isUser && variables.length > 0 && (
              <div className="mt-3 space-y-2 p-2 bg-muted/30 rounded border">
                <Label className="text-xs font-medium text-muted-foreground">Variable Values</Label>
                <div className="space-y-2">
                  {variables.map((varName) => (
                    <Input
                      key={varName}
                      value={turn.inputs?.[varName] || ""}
                      onChange={(e) =>
                        onUpdate(index, {
                          ...turn,
                          inputs: { ...(turn.inputs || {}), [varName]: e.target.value },
                        })
                      }
                      placeholder={`{{${varName}}}`}
                      className="h-8 text-sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Per-turn validation (for user turns when per-turn mode is enabled) */}
        {isUser && validationTiming === "per-turn" && (
          <Collapsible open={isValidationOpen} onOpenChange={setIsValidationOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs w-full justify-start"
              >
                {isValidationOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                Validation Rules
                {hasAnyValidation && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {(turn.validationRules?.length ?? 0) +
                      (turn.judgeValidationRules?.length ?? 0)}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 border-t pt-2">
              <ValidationRulesEditor
                rules={turn.validationRules || []}
                onChange={(rules) =>
                  onUpdate(index, { ...turn, validationRules: rules })
                }
                compact
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export function ConversationEditor({
  turns,
  variables,
  onChange,
  validationTiming,
  onValidationTimingChange,
  targetType,
}: ConversationEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace("turn-", ""));
      const newIndex = parseInt(String(over.id).replace("turn-", ""));

      onChange(arrayMove(turns, oldIndex, newIndex));
    }
  };

  const addTurn = (role: "user" | "assistant") => {
    const newTurn: ConversationTurn = {
      role,
      content: "",
      // Initialize inputs for user turns
      ...(role === "user" && variables.length > 0
        ? { inputs: variables.reduce((acc, v) => ({ ...acc, [v]: "" }), {}) }
        : {}),
    };
    onChange([...turns, newTurn]);
  };

  const updateTurn = (index: number, turn: ConversationTurn) => {
    const newTurns = [...turns];
    newTurns[index] = turn;
    onChange(newTurns);
  };

  const deleteTurn = (index: number) => {
    onChange(turns.filter((_, i) => i !== index));
  };

  // Determine next role suggestion
  const lastRole = turns.length > 0 ? turns[turns.length - 1].role : null;
  const suggestedNextRole = lastRole === "user" ? "assistant" : "user";

  return (
    <div className="space-y-4">
      {/* Header with validation timing toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Conversation Turns</Label>
          <Badge variant="outline" className="text-xs">
            {turns.length} turn{turns.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="validation-timing" className="text-xs text-muted-foreground">
            Validate:
          </Label>
          <Select
            value={validationTiming}
            onValueChange={(value) =>
              onValidationTimingChange(value as ValidationTimingMode)
            }
          >
            <SelectTrigger id="validation-timing" className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="final-only">Final only</SelectItem>
              <SelectItem value="per-turn">Per turn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">
        {targetType === "prompt"
          ? "Define a multi-turn conversation. User messages are sent to the LLM, and assistant messages provide context (simulated responses)."
          : "Define a sequence of HTTP requests. Each user turn represents a request, with session state preserved between turns."}
      </p>

      {/* Turns list */}
      <div>
        {turns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
            No conversation turns yet. Add a user message to start.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={turns.map((_, i) => `turn-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              {turns.map((turn, index) => (
                <SortableTurn
                  key={`turn-${index}`}
                  turn={turn}
                  index={index}
                  variables={variables}
                  validationTiming={validationTiming}
                  targetType={targetType}
                  onUpdate={updateTurn}
                  onDelete={deleteTurn}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add turn buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          variant={suggestedNextRole === "user" ? "default" : "outline"}
          size="sm"
          onClick={() => addTurn("user")}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          <User className="h-3 w-3" />
          User
        </Button>
        <Button
          variant={suggestedNextRole === "assistant" ? "default" : "outline"}
          size="sm"
          onClick={() => addTurn("assistant")}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          <Bot className="h-3 w-3" />
          Assistant
        </Button>
      </div>

      {/* Help text */}
      {validationTiming === "per-turn" && (
        <p className="text-xs text-muted-foreground text-center">
          Per-turn validation is enabled. Expand each user turn to configure validation rules.
        </p>
      )}
    </div>
  );
}
