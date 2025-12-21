"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Layers } from "lucide-react";
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS } from "@/lib/llm/types";

export interface ModelSelection {
  provider: "openai" | "anthropic" | "gemini";
  model: string;
}

interface MultiModelSelectorProps {
  selectedModels: ModelSelection[];
  onChange: (models: ModelSelection[]) => void;
  availableProviders?: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
  };
}

const PROVIDER_INFO = {
  openai: {
    name: "OpenAI",
    models: OPENAI_MODELS,
  },
  anthropic: {
    name: "Anthropic",
    models: ANTHROPIC_MODELS,
  },
  gemini: {
    name: "Google Gemini",
    models: GEMINI_MODELS,
  },
};

export function MultiModelSelector({
  selectedModels,
  onChange,
  availableProviders = { openai: true, anthropic: true, gemini: true },
}: MultiModelSelectorProps) {
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({
    openai: true,
    anthropic: false,
    gemini: false,
  });

  const isModelSelected = (provider: string, model: string) => {
    return selectedModels.some(
      (m) => m.provider === provider && m.model === model
    );
  };

  const toggleModel = (provider: "openai" | "anthropic" | "gemini", model: string) => {
    if (isModelSelected(provider, model)) {
      onChange(
        selectedModels.filter(
          (m) => !(m.provider === provider && m.model === model)
        )
      );
    } else {
      onChange([...selectedModels, { provider, model }]);
    }
  };

  const toggleProvider = (provider: "openai" | "anthropic" | "gemini") => {
    const providerModels = PROVIDER_INFO[provider].models;
    const allSelected = providerModels.every((model) =>
      isModelSelected(provider, model)
    );

    if (allSelected) {
      // Deselect all from this provider
      onChange(selectedModels.filter((m) => m.provider !== provider));
    } else {
      // Select all from this provider
      const existingOtherProviders = selectedModels.filter(
        (m) => m.provider !== provider
      );
      const allFromProvider = providerModels.map((model) => ({
        provider,
        model,
      }));
      onChange([...existingOtherProviders, ...allFromProvider]);
    }
  };

  const getProviderSelectedCount = (provider: string) => {
    return selectedModels.filter((m) => m.provider === provider).length;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Multi-Model Comparison
        </CardTitle>
        <CardDescription>
          Select multiple models to compare test results side-by-side
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(PROVIDER_INFO) as Array<"openai" | "anthropic" | "gemini">).map(
          (provider) => {
            const info = PROVIDER_INFO[provider];
            const isAvailable = availableProviders[provider];
            const selectedCount = getProviderSelectedCount(provider);
            const totalCount = info.models.length;
            const allSelected = selectedCount === totalCount;
            const someSelected = selectedCount > 0 && selectedCount < totalCount;

            return (
              <Collapsible
                key={provider}
                open={expandedProviders[provider]}
                onOpenChange={(open) =>
                  setExpandedProviders((prev) => ({ ...prev, [provider]: open }))
                }
              >
                <div
                  className={`border rounded-lg ${
                    !isAvailable ? "opacity-50" : ""
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-t-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={allSelected}
                          // Use data attribute for indeterminate state styling
                          data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                          onCheckedChange={() => toggleProvider(provider)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!isAvailable}
                        />
                        <div>
                          <Label className="font-medium cursor-pointer">
                            {info.name}
                          </Label>
                          {selectedCount > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({selectedCount}/{totalCount} selected)
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          expandedProviders[provider] ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                      {info.models.map((model) => (
                        <div
                          key={model}
                          className="flex items-center gap-2 py-1"
                        >
                          <Checkbox
                            id={`${provider}-${model}`}
                            checked={isModelSelected(provider, model)}
                            onCheckedChange={() => toggleModel(provider, model)}
                            disabled={!isAvailable}
                          />
                          <Label
                            htmlFor={`${provider}-${model}`}
                            className="text-sm font-mono cursor-pointer"
                          >
                            {model}
                          </Label>
                        </div>
                      ))}
                      {!isAvailable && (
                        <p className="text-xs text-amber-500 mt-2">
                          Configure {info.name} API key in Settings to use these models
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          }
        )}

        {selectedModels.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
