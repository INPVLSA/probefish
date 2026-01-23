import { vi } from 'vitest';
import type { LLMCompletionResponse, LLMProviderInterface } from '@/lib/llm/types';

export const mockAnthropicResponse: LLMCompletionResponse = {
  content: 'This is a mocked Anthropic response.',
  model: 'claude-3-5-haiku-latest',
  usage: {
    promptTokens: 15,
    completionTokens: 25,
    totalTokens: 40,
  },
  finishReason: 'end_turn',
};

export const mockAnthropicJudgeResponse: LLMCompletionResponse = {
  content: JSON.stringify({
    scores: {
      accuracy: { score: 9, reason: 'Excellent accuracy' },
      relevance: { score: 8, reason: 'Very relevant response' },
    },
    overall_reasoning: 'High quality response overall.',
  }),
  model: 'claude-3-5-haiku-latest',
  usage: {
    promptTokens: 60,
    completionTokens: 80,
    totalTokens: 140,
  },
  finishReason: 'end_turn',
};

export const createMockAnthropicProvider = (): LLMProviderInterface => ({
  name: 'anthropic',
  complete: vi.fn().mockResolvedValue(mockAnthropicResponse),
  listModels: vi.fn().mockReturnValue([
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
  ]),
});

export const anthropicProvider = createMockAnthropicProvider();
