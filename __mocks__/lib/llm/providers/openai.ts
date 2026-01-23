import { vi } from 'vitest';
import type { LLMCompletionResponse, LLMProviderInterface } from '@/lib/llm/types';

export const mockOpenAIResponse: LLMCompletionResponse = {
  content: 'This is a mocked OpenAI response.',
  model: 'gpt-4o-mini',
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  },
  finishReason: 'stop',
};

export const mockOpenAIJudgeResponse: LLMCompletionResponse = {
  content: JSON.stringify({
    scores: {
      accuracy: { score: 8, reason: 'Good accuracy in the response' },
      relevance: { score: 9, reason: 'Highly relevant to the prompt' },
      clarity: { score: 7, reason: 'Generally clear but could be improved' },
    },
    overall_reasoning: 'The response demonstrates good understanding and relevance.',
  }),
  model: 'gpt-4o-mini',
  usage: {
    promptTokens: 50,
    completionTokens: 100,
    totalTokens: 150,
  },
  finishReason: 'stop',
};

export const createMockOpenAIProvider = (): LLMProviderInterface => ({
  name: 'openai',
  complete: vi.fn().mockResolvedValue(mockOpenAIResponse),
  listModels: vi.fn().mockReturnValue([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ]),
});

export const openaiProvider = createMockOpenAIProvider();
