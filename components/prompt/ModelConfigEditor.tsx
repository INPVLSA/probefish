"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Cpu, ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, DEFAULT_MODELS } from "@/lib/llm/types";

export interface ModelConfig {
  provider?: "openai" | "anthropic" | "gemini" | "custom";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

interface ModelConfigEditorProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export function ModelConfigEditor({ config, onChange }: ModelConfigEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const provider = config.provider || "openai";
  const models =
    provider === "anthropic"
      ? ANTHROPIC_MODELS
      : provider === "gemini"
        ? GEMINI_MODELS
        : OPENAI_MODELS;

  const handleProviderChange = (newProvider: "openai" | "anthropic" | "gemini") => {
    onChange({
      ...config,
      provider: newProvider,
      model: DEFAULT_MODELS[newProvider],
    });
  };

  const handleModelChange = (model: string) => {
    onChange({ ...config, model });
  };

  const handleTemperatureChange = (value: number[]) => {
    onChange({ ...config, temperature: value[0] });
  };

  const handleMaxTokensChange = (value: string) => {
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      onChange({ ...config, maxTokens: undefined });
    } else {
      onChange({ ...config, maxTokens: Math.min(128000, Math.max(1, parsed)) });
    }
  };

  const handleTopPChange = (value: number[]) => {
    onChange({ ...config, topP: value[0] });
  };

  const handleFrequencyPenaltyChange = (value: number[]) => {
    onChange({ ...config, frequencyPenalty: value[0] });
  };

  const handlePresencePenaltyChange = (value: number[]) => {
    onChange({ ...config, presencePenalty: value[0] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Model Configuration</CardTitle>
            <CardDescription>
              Configure the LLM provider and model for this prompt
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">
              {(config.temperature ?? 0.7).toFixed(2)}
            </span>
          </div>
          <Slider
            value={[config.temperature ?? 0.7]}
            onValueChange={handleTemperatureChange}
            min={0}
            max={2}
            step={0.01}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Lower values make output more focused and deterministic. Higher values make it more creative.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input
            type="number"
            min={1}
            max={128000}
            value={config.maxTokens ?? ""}
            onChange={(e) => handleMaxTokensChange(e.target.value)}
            placeholder="Default (model-specific)"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of tokens in the response. Leave empty for model default.
          </p>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Advanced Parameters
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  advancedOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Top P</Label>
                <span className="text-sm text-muted-foreground">
                  {config.topP !== undefined ? config.topP.toFixed(2) : "Default"}
                </span>
              </div>
              <Slider
                value={[config.topP ?? 1]}
                onValueChange={handleTopPChange}
                min={0}
                max={1}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Nucleus sampling threshold. Consider only tokens with cumulative probability up to this value.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Frequency Penalty</Label>
                <span className="text-sm text-muted-foreground">
                  {config.frequencyPenalty !== undefined
                    ? config.frequencyPenalty.toFixed(2)
                    : "Default"}
                </span>
              </div>
              <Slider
                value={[config.frequencyPenalty ?? 0]}
                onValueChange={handleFrequencyPenaltyChange}
                min={-2}
                max={2}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalize tokens based on their frequency in the text. Higher values reduce repetition.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Presence Penalty</Label>
                <span className="text-sm text-muted-foreground">
                  {config.presencePenalty !== undefined
                    ? config.presencePenalty.toFixed(2)
                    : "Default"}
                </span>
              </div>
              <Slider
                value={[config.presencePenalty ?? 0]}
                onValueChange={handlePresencePenaltyChange}
                min={-2}
                max={2}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalize tokens that have appeared at all. Higher values encourage new topics.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
