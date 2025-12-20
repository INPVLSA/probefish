import {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProviderCredentials,
  LLMMessage,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
} from "./types";
import { openaiProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";
import { geminiProvider } from "./providers/gemini";

export class LLMService {
  private getProvider(provider: LLMProvider) {
    switch (provider) {
      case "openai":
        return openaiProvider;
      case "anthropic":
        return anthropicProvider;
      case "gemini":
        return geminiProvider;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getApiKey(
    provider: LLMProvider,
    credentials: LLMProviderCredentials
  ): string {
    switch (provider) {
      case "openai":
        if (!credentials.openaiApiKey) {
          throw new Error("OpenAI API key not configured");
        }
        return credentials.openaiApiKey;
      case "anthropic":
        if (!credentials.anthropicApiKey) {
          throw new Error("Anthropic API key not configured");
        }
        return credentials.anthropicApiKey;
      case "gemini":
        if (!credentials.geminiApiKey) {
          throw new Error("Gemini API key not configured");
        }
        return credentials.geminiApiKey;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async complete(
    request: LLMCompletionRequest,
    credentials: LLMProviderCredentials
  ): Promise<LLMCompletionResponse> {
    const provider = this.getProvider(request.provider);
    const apiKey = this.getApiKey(request.provider, credentials);

    return provider.complete(
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      apiKey
    );
  }

  // Helper method to create a simple completion with system and user messages
  async simpleComplete(
    params: {
      provider: LLMProvider;
      model: string;
      systemPrompt?: string;
      userMessage: string;
      temperature?: number;
      maxTokens?: number;
    },
    credentials: LLMProviderCredentials
  ): Promise<LLMCompletionResponse> {
    const messages: LLMMessage[] = [];

    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }

    messages.push({ role: "user", content: params.userMessage });

    return this.complete(
      {
        provider: params.provider,
        model: params.model,
        messages,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      },
      credentials
    );
  }

  // Get available models for a provider
  getModels(provider: LLMProvider): string[] {
    switch (provider) {
      case "openai":
        return [...OPENAI_MODELS];
      case "anthropic":
        return [...ANTHROPIC_MODELS];
      case "gemini":
        return [...GEMINI_MODELS];
      default:
        return [];
    }
  }

  // Get all providers
  getProviders(): LLMProvider[] {
    return ["openai", "anthropic", "gemini"];
  }

  // Check if credentials are configured for a provider
  hasCredentials(
    provider: LLMProvider,
    credentials: LLMProviderCredentials
  ): boolean {
    switch (provider) {
      case "openai":
        return !!credentials.openaiApiKey;
      case "anthropic":
        return !!credentials.anthropicApiKey;
      case "gemini":
        return !!credentials.geminiApiKey;
      default:
        return false;
    }
  }
}

// Singleton instance
export const llmService = new LLMService();
