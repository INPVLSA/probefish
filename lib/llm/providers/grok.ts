import {
  LLMProviderInterface,
  LLMCompletionRequest,
  LLMCompletionResponse,
  GROK_MODELS,
} from "../types";

export class GrokProvider implements LLMProviderInterface {
  name = "grok" as const;

  async complete(
    request: Omit<LLMCompletionRequest, "provider">,
    apiKey: string
  ): Promise<LLMCompletionResponse> {
    // xAI API uses OpenAI-compatible format
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Grok API error: ${response.status}`
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("No response from Grok");
    }

    return {
      content: choice.message?.content || "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason,
    };
  }

  listModels(): string[] {
    return [...GROK_MODELS];
  }
}

export const grokProvider = new GrokProvider();
