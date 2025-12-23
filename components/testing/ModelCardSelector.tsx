"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { X, Plus, ChevronDown, AlertCircle, Star, Zap, Brain } from "lucide-react";
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, GROK_MODELS, DEEPSEEK_MODELS, getModelLabel, getModelType, ModelType } from "@/lib/llm/types";
import { OpenAILogo } from "@/components/ui/openai-logo";
import { AnthropicLogo } from "@/components/ui/anthropic-logo";
import { GeminiLogo } from "@/components/ui/gemini-logo";
import { GrokLogo } from "@/components/ui/grok-logo";
import { DeepSeekLogo } from "@/components/ui/deepseek-logo";

export interface ModelSelection {
  provider: "openai" | "anthropic" | "gemini" | "grok" | "deepseek";
  model: string;
  isPrimary?: boolean;
}

interface ModelCardSelectorProps {
  selectedModels: ModelSelection[];
  onChange: (models: ModelSelection[]) => void;
  availableProviders: { openai: boolean; anthropic: boolean; gemini: boolean; grok: boolean; deepseek: boolean };
  disabled?: boolean;
}

const getModelTypeIcon = (type: ModelType) => {
  switch (type) {
    case "fast":
      return <Zap className="h-3 w-3 text-yellow-500" />;
    case "thinking":
      return <Brain className="h-3 w-3 text-purple-500" />;
    default:
      return null;
  }
};

const getModelTypeLabel = (type: ModelType) => {
  switch (type) {
    case "fast":
      return "Fast model - optimized for speed";
    case "thinking":
      return "Thinking model - extended reasoning";
    default:
      return null;
  }
};

const PROVIDER_CONFIG = {
  openai: {
    name: "OpenAI",
    models: OPENAI_MODELS,
    Icon: OpenAILogo,
    styles: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400",
    badgeStyles: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  anthropic: {
    name: "Anthropic",
    models: ANTHROPIC_MODELS,
    Icon: AnthropicLogo,
    styles: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400",
    badgeStyles: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  gemini: {
    name: "Gemini",
    models: GEMINI_MODELS,
    Icon: GeminiLogo,
    styles: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400",
    badgeStyles: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  grok: {
    name: "Grok",
    models: GROK_MODELS,
    Icon: GrokLogo,
    styles: "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/20 dark:border-slate-800 dark:text-slate-400",
    badgeStyles: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  },
  deepseek: {
    name: "DeepSeek",
    models: DEEPSEEK_MODELS,
    Icon: DeepSeekLogo,
    styles: "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400",
    badgeStyles: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
};

export function ModelCardSelector({
  selectedModels,
  onChange,
  availableProviders,
  disabled = false,
}: ModelCardSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(["openai", "anthropic", "gemini", "grok", "deepseek"])
  );

  const toggleProvider = (provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const removeModel = (index: number) => {
    const removedModel = selectedModels[index];
    let newModels = selectedModels.filter((_, i) => i !== index);

    // If we removed the primary model, make the first remaining model primary
    if (removedModel.isPrimary && newModels.length > 0) {
      newModels = newModels.map((m, i) =>
        i === 0 ? { ...m, isPrimary: true } : m
      );
    }
    onChange(newModels);
  };

  const setPrimaryModel = (index: number) => {
    const newModels = selectedModels.map((m, i) => ({
      ...m,
      isPrimary: i === index,
    }));
    onChange(newModels);
  };

  const addModel = (provider: "openai" | "anthropic" | "gemini" | "grok" | "deepseek", model: string) => {
    // Check if already selected
    const exists = selectedModels.some(
      (m) => m.provider === provider && m.model === model
    );
    if (!exists) {
      // First model added becomes primary
      const isPrimary = selectedModels.length === 0;
      onChange([...selectedModels, { provider, model, isPrimary }]);
    }
    // Keep dialog open to allow adding more models
  };

  const isModelSelected = (provider: string, model: string) => {
    return selectedModels.some(
      (m) => m.provider === provider && m.model === model
    );
  };


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedModels.map((selection, index) => {
          const config = PROVIDER_CONFIG[selection.provider];
          const Icon = config.Icon;
          const isAvailable = availableProviders[selection.provider];
          const isPrimary = selection.isPrimary;
          const modelType = getModelType(selection.model);
          const typeIcon = getModelTypeIcon(modelType);
          const typeLabel = getModelTypeLabel(modelType);

          return (
            <div
              key={`${selection.provider}-${selection.model}-${index}`}
              className={`
                relative flex items-center gap-2 px-3 py-2 rounded-lg border
                ${config.styles}
                ${!isAvailable ? "opacity-60" : ""}
                ${isPrimary ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}
              `}
            >
              <Icon size={16} className="flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium opacity-70 flex items-center gap-1">
                  {config.name}
                  {typeIcon && typeLabel && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{typeIcon}</span>
                      </TooltipTrigger>
                      <TooltipContent>{typeLabel}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="text-sm truncate" title={selection.model}>
                  {(() => {
                    const label = getModelLabel(selection.model);
                    const match = label.match(/^(.+?)\s*\([^)]+\)$/);
                    return match ? match[1] : label;
                  })()}
                </span>
              </div>
              {!isAvailable && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>API key not configured</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setPrimaryModel(index)}
                    disabled={disabled || isPrimary}
                    className={`p-0.5 rounded transition-colors ${
                      isPrimary
                        ? "text-yellow-500"
                        : "opacity-40 hover:opacity-100 hover:text-yellow-500"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isPrimary ? "fill-current" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPrimary ? "Primary model" : "Set as primary"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => removeModel(index)}
                    disabled={disabled}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove model</TooltipContent>
              </Tooltip>
            </div>
          );
        })}

        {/* Add Model Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <button
                  disabled={disabled}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed
                    border-muted-foreground/30 text-muted-foreground
                    hover:border-muted-foreground/50 hover:text-foreground
                    transition-colors cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add Model</span>
                </button>
              </DialogTrigger>
            </TooltipTrigger>
            {selectedModels.length === 0 && (
              <TooltipContent>
                Add at least one model to run tests
              </TooltipContent>
            )}
          </Tooltip>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Model</DialogTitle>
              <DialogDescription>
                Select a model to add to your comparison set
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {(Object.entries(PROVIDER_CONFIG) as [keyof typeof PROVIDER_CONFIG, typeof PROVIDER_CONFIG.openai][]).map(
                ([provider, config]) => {
                  const isAvailable = availableProviders[provider];
                  const Icon = config.Icon;
                  const isExpanded = expandedProviders.has(provider);

                  return (
                    <Collapsible
                      key={provider}
                      open={isExpanded}
                      onOpenChange={() => toggleProvider(provider)}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          className={`
                            w-full flex items-center justify-between p-3 rounded-lg border
                            ${config.styles}
                            hover:opacity-90 transition-opacity
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={20} />
                            <span className="font-medium">{config.name}</span>
                            {!isAvailable && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <AlertCircle className="h-3 w-3" />
                                No API Key
                              </Badge>
                            )}
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="grid gap-1 pl-2">
                          {config.models.map((model) => {
                            const selected = isModelSelected(provider, model);
                            const modelType = getModelType(model);
                            const typeIcon = getModelTypeIcon(modelType);
                            const typeLabel = getModelTypeLabel(modelType);
                            return (
                              <button
                                key={model}
                                onClick={() => addModel(provider, model)}
                                disabled={selected || !isAvailable}
                                className={`
                                  text-left px-3 py-2 rounded text-sm flex items-center
                                  transition-colors
                                  ${
                                    selected
                                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                                      : isAvailable
                                      ? "hover:bg-muted cursor-pointer"
                                      : "text-muted-foreground cursor-not-allowed"
                                  }
                                `}
                                title={model}
                              >
                                {typeIcon && (
                                  <span className="mr-2" title={typeLabel || undefined}>
                                    {typeIcon}
                                  </span>
                                )}
                                <span className="flex-1">
                                  {(() => {
                                    const label = getModelLabel(model);
                                    const match = label.match(/^(.+?)(\s*\([^)]+\))$/);
                                    if (match) {
                                      return (
                                        <>
                                          {match[1]}
                                          <span className="text-muted-foreground">{match[2]}</span>
                                        </>
                                      );
                                    }
                                    return label;
                                  })()}
                                </span>
                                {selected && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
