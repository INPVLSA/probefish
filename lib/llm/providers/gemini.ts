import {
  LLMProviderInterface,
  LLMCompletionRequest,
  LLMCompletionResponse,
  GEMINI_MODELS,
} from "../types";

export class GeminiProvider implements LLMProviderInterface {
  name = "gemini" as const;

  async complete(
    request: Omit<LLMCompletionRequest, "provider">,
    apiKey: string
  ): Promise<LLMCompletionResponse> {
    // Convert messages to Gemini format
    // Gemini uses "contents" with "parts" structure
    // System instructions are handled separately

    let systemInstruction: string | undefined;
    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    for (const message of request.messages) {
      if (message.role === "system") {
        systemInstruction = message.content;
      } else {
        contents.push({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        });
      }
    }

    // Build request body
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Gemini API error: ${response.status}`
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error("No response from Gemini");
    }

    const content = candidate.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("") || "";

    return {
      content,
      model: request.model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      finishReason: candidate.finishReason,
    };
  }

  listModels(): string[] {
    return [...GEMINI_MODELS];
  }
}

export const geminiProvider = new GeminiProvider();
