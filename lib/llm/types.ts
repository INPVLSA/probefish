// LLM Provider Types

export type LLMProvider = "openai" | "anthropic" | "gemini";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionRequest {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMProviderCredentials {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
}

export interface LLMProviderInterface {
  name: LLMProvider;
  complete(
    request: Omit<LLMCompletionRequest, "provider">,
    apiKey: string
  ): Promise<LLMCompletionResponse>;
  listModels(): string[];
}

// Available models for each provider
export const OPENAI_MODELS = [
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
] as const;

export const ANTHROPIC_MODELS = [
  "claude-opus-4-5-20251101",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251015",
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
] as const;

export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export type OpenAIModel = (typeof OPENAI_MODELS)[number];
export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];
export type GeminiModel = (typeof GEMINI_MODELS)[number];

// Human-readable labels for models
export const MODEL_LABELS: Record<string, string> = {
  // OpenAI
  "gpt-5.2": "GPT-5.2 (gpt-5.2)",
  "gpt-5.1": "GPT-5.1 (gpt-5.1)",
  "gpt-5": "GPT-5 (gpt-5)",
  "gpt-5-mini": "GPT-5 Mini (gpt-5-mini)",
  "gpt-4.1": "GPT-4.1 (gpt-4.1)",
  "gpt-4.1-mini": "GPT-4.1 Mini (gpt-4.1-mini)",
  "gpt-4o": "GPT-4o (gpt-4o)",
  "gpt-4o-mini": "GPT-4o Mini (gpt-4o-mini)",
  // Anthropic
  "claude-opus-4-5-20251101": "Claude Opus 4.5 (claude-opus-4-5-20251101)",
  "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)",
  "claude-haiku-4-5-20251015": "Claude Haiku 4.5 (claude-haiku-4-5-20251015)",
  "claude-opus-4-20250514": "Claude Opus 4 (claude-opus-4-20250514)",
  "claude-sonnet-4-20250514": "Claude Sonnet 4 (claude-sonnet-4-20250514)",
  // Gemini
  "gemini-3-flash-preview": "Gemini 3 Flash Preview (gemini-3-flash-preview)",
  "gemini-2.5-pro": "Gemini 2.5 Pro (gemini-2.5-pro)",
  "gemini-2.5-flash": "Gemini 2.5 Flash (gemini-2.5-flash)",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (gemini-2.5-flash-lite)",
  "gemini-2.0-flash": "Gemini 2.0 Flash (gemini-2.0-flash)",
  "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite (gemini-2.0-flash-lite)",
};

export function getModelLabel(model: string): string {
  return MODEL_LABELS[model] || model;
}

// Model characteristics - 'fast' for quick/efficient models, 'thinking' for extended reasoning
export type ModelType = "fast" | "thinking" | "standard";

export const MODEL_TYPES: Record<string, ModelType> = {
  // OpenAI - mini models are fast
  "gpt-5-mini": "fast",
  "gpt-4.1-mini": "fast",
  "gpt-4o-mini": "fast",
  // Anthropic - Haiku is fast, Opus models could be extended thinking
  "claude-haiku-4-5-20251015": "fast",
  "claude-opus-4-5-20251101": "thinking",
  "claude-opus-4-20250514": "thinking",
  // Gemini - flash/lite models are fast
  "gemini-3-flash-preview": "fast",
  "gemini-2.5-flash": "fast",
  "gemini-2.5-flash-lite": "fast",
  "gemini-2.0-flash": "fast",
  "gemini-2.0-flash-lite": "fast",
};

export function getModelType(model: string): ModelType {
  return MODEL_TYPES[model] || "standard";
}
