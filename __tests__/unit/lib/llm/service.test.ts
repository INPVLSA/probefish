import { describe, it, expect } from 'vitest';
import { llmService } from '@/lib/llm/service';
import {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  GROK_MODELS,
} from '@/lib/llm/types';

describe('LLMService', () => {
  describe('getProviders', () => {
    it('should return all supported providers', () => {
      const providers = llmService.getProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('gemini');
      expect(providers).toContain('grok');
      expect(providers).toHaveLength(4);
    });
  });

  describe('getModels', () => {
    it('should return OpenAI models for openai provider', () => {
      const models = llmService.getModels('openai');
      expect(models).toEqual([...OPENAI_MODELS]);
      expect(models).toContain('gpt-4o-mini');
    });

    it('should return Anthropic models for anthropic provider', () => {
      const models = llmService.getModels('anthropic');
      expect(models).toEqual([...ANTHROPIC_MODELS]);
      expect(models.some(m => m.includes('claude'))).toBe(true);
    });

    it('should return Gemini models for gemini provider', () => {
      const models = llmService.getModels('gemini');
      expect(models).toEqual([...GEMINI_MODELS]);
      expect(models.some(m => m.includes('gemini'))).toBe(true);
    });

    it('should return Grok models for grok provider', () => {
      const models = llmService.getModels('grok');
      expect(models).toEqual([...GROK_MODELS]);
      expect(models.some(m => m.includes('grok'))).toBe(true);
    });

    it('should return empty array for unknown provider', () => {
      const models = llmService.getModels('unknown' as any);
      expect(models).toEqual([]);
    });
  });

  describe('hasCredentials', () => {
    it('should return true when OpenAI API key is set', () => {
      const result = llmService.hasCredentials('openai', {
        openaiApiKey: 'sk-test-key',
      });
      expect(result).toBe(true);
    });

    it('should return false when OpenAI API key is not set', () => {
      const result = llmService.hasCredentials('openai', {});
      expect(result).toBe(false);
    });

    it('should return true when Anthropic API key is set', () => {
      const result = llmService.hasCredentials('anthropic', {
        anthropicApiKey: 'sk-ant-test-key',
      });
      expect(result).toBe(true);
    });

    it('should return false when Anthropic API key is not set', () => {
      const result = llmService.hasCredentials('anthropic', {});
      expect(result).toBe(false);
    });

    it('should return true when Gemini API key is set', () => {
      const result = llmService.hasCredentials('gemini', {
        geminiApiKey: 'AIza-test-key',
      });
      expect(result).toBe(true);
    });

    it('should return false when Gemini API key is not set', () => {
      const result = llmService.hasCredentials('gemini', {});
      expect(result).toBe(false);
    });

    it('should return true when Grok API key is set', () => {
      const result = llmService.hasCredentials('grok', {
        grokApiKey: 'xai-test-key',
      });
      expect(result).toBe(true);
    });

    it('should return false when Grok API key is not set', () => {
      const result = llmService.hasCredentials('grok', {});
      expect(result).toBe(false);
    });

    it('should return false for unknown provider', () => {
      const result = llmService.hasCredentials('unknown' as any, {
        openaiApiKey: 'sk-test',
      });
      expect(result).toBe(false);
    });

    it('should check correct key for each provider', () => {
      const credentials = {
        openaiApiKey: 'sk-openai',
        anthropicApiKey: 'sk-anthropic',
        geminiApiKey: 'gemini-key',
        grokApiKey: 'xai-key',
      };

      // Each provider should only care about its own key
      expect(llmService.hasCredentials('openai', { anthropicApiKey: 'x' })).toBe(false);
      expect(llmService.hasCredentials('anthropic', { openaiApiKey: 'x' })).toBe(false);
      expect(llmService.hasCredentials('gemini', { openaiApiKey: 'x' })).toBe(false);
      expect(llmService.hasCredentials('grok', { openaiApiKey: 'x' })).toBe(false);

      // But should work with all keys present
      expect(llmService.hasCredentials('openai', credentials)).toBe(true);
      expect(llmService.hasCredentials('anthropic', credentials)).toBe(true);
      expect(llmService.hasCredentials('gemini', credentials)).toBe(true);
      expect(llmService.hasCredentials('grok', credentials)).toBe(true);
    });
  });
});
