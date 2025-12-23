import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openaiProvider } from '@/lib/llm/providers/openai';
import { anthropicProvider } from '@/lib/llm/providers/anthropic';
import { geminiProvider } from '@/lib/llm/providers/gemini';
import { grokProvider } from '@/lib/llm/providers/grok';
import { deepseekProvider } from '@/lib/llm/providers/deepseek';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, GROK_MODELS, DEEPSEEK_MODELS, DEFAULT_MODELS } from '@/lib/llm/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAI Provider', () => {
  describe('name', () => {
    it('should have correct provider name', () => {
      expect(openaiProvider.name).toBe('openai');
    });
  });

  describe('listModels', () => {
    it('should return all OpenAI models', () => {
      const models = openaiProvider.listModels();
      expect(models).toEqual([...OPENAI_MODELS]);
    });
  });

  describe('complete', () => {
    it('should send correct request format to OpenAI API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello!' } }],
          model: 'gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await openaiProvider.complete(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
          temperature: 0.5,
          maxTokens: 100,
        },
        'sk-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-key',
          },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
    });

    it('should parse successful response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          model: 'gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await openaiProvider.complete(
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(result.finishReason).toBe('stop');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(
        openaiProvider.complete(
          {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'invalid-key'
        )
      ).rejects.toThrow('Invalid API key');
    });
  });
});

describe('Anthropic Provider', () => {
  describe('name', () => {
    it('should have correct provider name', () => {
      expect(anthropicProvider.name).toBe('anthropic');
    });
  });

  describe('listModels', () => {
    it('should return all Anthropic models', () => {
      const models = anthropicProvider.listModels();
      expect(models).toEqual([...ANTHROPIC_MODELS]);
    });
  });

  describe('complete', () => {
    it('should convert messages to Anthropic format with system separate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello!' }],
          model: DEFAULT_MODELS.anthropic,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
          stop_reason: 'end_turn',
        }),
      });

      await anthropicProvider.complete(
        {
          model: DEFAULT_MODELS.anthropic,
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
          temperature: 0.7,
          maxTokens: 100,
        },
        'sk-ant-test-key'
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // System message should be separate
      expect(body.system).toBe('You are helpful.');

      // Messages should only contain non-system messages
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);

      expect(body.model).toBe(DEFAULT_MODELS.anthropic);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(100);
    });

    it('should use correct Anthropic API headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello!' }],
          model: DEFAULT_MODELS.anthropic,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await anthropicProvider.complete(
        {
          model: DEFAULT_MODELS.anthropic,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-ant-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should parse successful response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Test response' }],
          model: DEFAULT_MODELS.anthropic,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
          stop_reason: 'end_turn',
        }),
      });

      const result = await anthropicProvider.complete(
        {
          model: DEFAULT_MODELS.anthropic,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-ant-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.model).toBe(DEFAULT_MODELS.anthropic);
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(result.finishReason).toBe('end_turn');
    });
  });
});

describe('Gemini Provider', () => {
  describe('name', () => {
    it('should have correct provider name', () => {
      expect(geminiProvider.name).toBe('gemini');
    });
  });

  describe('listModels', () => {
    it('should return all Gemini models', () => {
      const models = geminiProvider.listModels();
      expect(models).toEqual([...GEMINI_MODELS]);
    });
  });

  describe('complete', () => {
    it('should convert messages to Gemini format with contents/parts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Hello!' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      });

      await geminiProvider.complete(
        {
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
            { role: 'user', content: 'How are you?' },
          ],
          temperature: 0.7,
          maxTokens: 100,
        },
        'AIza-test-key'
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // System instruction should be separate
      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'You are helpful.' }],
      });

      // Messages should be converted to contents with role mapping
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hi' }] },
        { role: 'model', parts: [{ text: 'Hello!' }] },
        { role: 'user', parts: [{ text: 'How are you?' }] },
      ]);

      expect(body.generationConfig.temperature).toBe(0.7);
      expect(body.generationConfig.maxOutputTokens).toBe(100);
    });

    it('should use API key as query parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
        }),
      });

      await geminiProvider.complete(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'AIza-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIza-test-key',
        expect.any(Object)
      );
    });

    it('should parse successful response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Part 1' }, { text: ' Part 2' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      });

      const result = await geminiProvider.complete(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'AIza-test-key'
      );

      // Should concatenate multiple parts
      expect(result.content).toBe('Part 1 Part 2');
      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(result.finishReason).toBe('STOP');
    });

    it('should handle missing system message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
        }),
      });

      await geminiProvider.complete(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'AIza-test-key'
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.systemInstruction).toBeUndefined();
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hi' }] },
      ]);
    });

    it('should throw error when no candidates returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [],
        }),
      });

      await expect(
        geminiProvider.complete(
          {
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'AIza-test-key'
        )
      ).rejects.toThrow('No response from Gemini');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid request' },
        }),
      });

      await expect(
        geminiProvider.complete(
          {
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'invalid-key'
        )
      ).rejects.toThrow('Invalid request');
    });
  });
});

describe('DeepSeek Provider', () => {
  describe('name', () => {
    it('should have correct provider name', () => {
      expect(deepseekProvider.name).toBe('deepseek');
    });
  });

  describe('listModels', () => {
    it('should return all DeepSeek models', () => {
      const models = deepseekProvider.listModels();
      expect(models).toEqual([...DEEPSEEK_MODELS]);
    });
  });

  describe('complete', () => {
    it('should send correct request format to DeepSeek API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello!' } }],
          model: 'deepseek-chat',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await deepseekProvider.complete(
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
          temperature: 0.5,
          maxTokens: 100,
        },
        'sk-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-key',
          },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('deepseek-chat');
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
    });

    it('should parse successful response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          model: 'deepseek-chat',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await deepseekProvider.complete(
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.model).toBe('deepseek-chat');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(result.finishReason).toBe('stop');
    });

    it('should use default temperature when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hi' } }],
          model: 'deepseek-chat',
        }),
      });

      await deepseekProvider.complete(
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-test-key'
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.7);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(
        deepseekProvider.complete(
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'invalid-key'
        )
      ).rejects.toThrow('Invalid API key');
    });

    it('should throw generic error when API error has no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(
        deepseekProvider.complete(
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'sk-test-key'
        )
      ).rejects.toThrow('DeepSeek API error: 500');
    });

    it('should throw error when no choices returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      await expect(
        deepseekProvider.complete(
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'sk-test-key'
        )
      ).rejects.toThrow('No response from DeepSeek');
    });

    it('should handle response without usage data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          model: 'deepseek-chat',
        }),
      });

      const result = await deepseekProvider.complete(
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'sk-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.usage).toBeUndefined();
    });
  });
});

describe('Grok Provider', () => {
  describe('name', () => {
    it('should have correct provider name', () => {
      expect(grokProvider.name).toBe('grok');
    });
  });

  describe('listModels', () => {
    it('should return all Grok models', () => {
      const models = grokProvider.listModels();
      expect(models).toEqual([...GROK_MODELS]);
    });
  });

  describe('complete', () => {
    it('should send correct request format to xAI API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello!' } }],
          model: 'grok-3-mini-fast',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      await grokProvider.complete(
        {
          model: 'grok-3-mini-fast',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
          temperature: 0.5,
          maxTokens: 100,
        },
        'xai-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer xai-test-key',
          },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('grok-3-mini-fast');
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
    });

    it('should parse successful response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          model: 'grok-3-mini-fast',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await grokProvider.complete(
        {
          model: 'grok-3-mini-fast',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'xai-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.model).toBe('grok-3-mini-fast');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(result.finishReason).toBe('stop');
    });

    it('should use default temperature when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hi' } }],
          model: 'grok-3-mini-fast',
        }),
      });

      await grokProvider.complete(
        {
          model: 'grok-3-mini-fast',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'xai-test-key'
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.7);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(
        grokProvider.complete(
          {
            model: 'grok-3-mini-fast',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'invalid-key'
        )
      ).rejects.toThrow('Invalid API key');
    });

    it('should throw generic error when API error has no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(
        grokProvider.complete(
          {
            model: 'grok-3-mini-fast',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'xai-test-key'
        )
      ).rejects.toThrow('Grok API error: 500');
    });

    it('should throw error when no choices returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      await expect(
        grokProvider.complete(
          {
            model: 'grok-3-mini-fast',
            messages: [{ role: 'user', content: 'Hi' }],
          },
          'xai-test-key'
        )
      ).rejects.toThrow('No response from Grok');
    });

    it('should handle response without usage data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response' },
              finish_reason: 'stop',
            },
          ],
          model: 'grok-3-mini-fast',
        }),
      });

      const result = await grokProvider.complete(
        {
          model: 'grok-3-mini-fast',
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'xai-test-key'
      );

      expect(result.content).toBe('Test response');
      expect(result.usage).toBeUndefined();
    });
  });
});

describe('Provider role mapping', () => {
  it('OpenAI should pass through roles unchanged', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hi' } }],
        model: 'gpt-4o-mini',
      }),
    });

    await openaiProvider.complete(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Assistant' },
        ],
      },
      'sk-test'
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[2].role).toBe('assistant');
  });

  it('Anthropic should extract system and keep user/assistant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Hi' }],
        model: DEFAULT_MODELS.anthropic,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });

    await anthropicProvider.complete(
      {
        model: DEFAULT_MODELS.anthropic,
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Assistant' },
        ],
      },
      'sk-ant-test'
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('System');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
  });

  it('Gemini should map assistant to model and extract system', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Hi' }] } }],
      }),
    });

    await geminiProvider.complete(
      {
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Assistant' },
        ],
      },
      'AIza-test'
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.systemInstruction.parts[0].text).toBe('System');
    expect(body.contents).toHaveLength(2);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[1].role).toBe('model'); // assistant -> model
  });

  it('Grok should pass through roles unchanged (OpenAI-compatible)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hi' } }],
        model: 'grok-3-mini-fast',
      }),
    });

    await grokProvider.complete(
      {
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Assistant' },
        ],
      },
      'xai-test'
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[2].role).toBe('assistant');
  });

  it('DeepSeek should pass through roles unchanged (OpenAI-compatible)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hi' } }],
        model: 'deepseek-chat',
      }),
    });

    await deepseekProvider.complete(
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User' },
          { role: 'assistant', content: 'Assistant' },
        ],
      },
      'sk-test'
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[2].role).toBe('assistant');
  });
});
