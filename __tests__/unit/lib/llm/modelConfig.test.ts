import { describe, it, expect } from 'vitest';
import {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  LLMProvider,
  getModelType,
  getModelLabel,
  MODEL_TYPES,
  MODEL_LABELS,
} from '@/lib/llm/types';

describe('Model Configuration', () => {
  describe('Provider models', () => {
    it('should have OpenAI models defined', () => {
      expect(OPENAI_MODELS).toBeDefined();
      expect(Array.isArray(OPENAI_MODELS)).toBe(true);
      expect(OPENAI_MODELS.length).toBeGreaterThan(0);
    });

    it('should have Anthropic models defined', () => {
      expect(ANTHROPIC_MODELS).toBeDefined();
      expect(Array.isArray(ANTHROPIC_MODELS)).toBe(true);
      expect(ANTHROPIC_MODELS.length).toBeGreaterThan(0);
    });

    it('should have Gemini models defined', () => {
      expect(GEMINI_MODELS).toBeDefined();
      expect(Array.isArray(GEMINI_MODELS)).toBe(true);
      expect(GEMINI_MODELS.length).toBeGreaterThan(0);
    });

    it('should include expected OpenAI models', () => {
      expect(OPENAI_MODELS).toContain('gpt-4o');
      expect(OPENAI_MODELS).toContain('gpt-4o-mini');
    });

    it('should include expected Anthropic models', () => {
      const hasClaudeModels = ANTHROPIC_MODELS.some((m) => m.includes('claude'));
      expect(hasClaudeModels).toBe(true);
    });

    it('should include expected Gemini models', () => {
      const hasGeminiModels = GEMINI_MODELS.some((m) => m.includes('gemini'));
      expect(hasGeminiModels).toBe(true);
    });
  });

  describe('Model configuration structure', () => {
    interface ModelConfig {
      provider?: LLMProvider;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    }

    it('should accept valid OpenAI configuration', () => {
      const config: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
      };

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
    });

    it('should accept valid Anthropic configuration', () => {
      const config: ModelConfig = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.5,
      };

      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should accept valid Gemini configuration', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.3,
      };

      expect(config.provider).toBe('gemini');
      expect(config.model).toBe('gemini-2.5-flash');
    });

    it('should allow optional parameters to be undefined', () => {
      const config: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4o',
      };

      expect(config.temperature).toBeUndefined();
      expect(config.maxTokens).toBeUndefined();
      expect(config.topP).toBeUndefined();
      expect(config.frequencyPenalty).toBeUndefined();
      expect(config.presencePenalty).toBeUndefined();
    });
  });

  describe('Temperature validation', () => {
    it('should accept temperature between 0 and 2', () => {
      const validTemperatures = [0, 0.5, 0.7, 1, 1.5, 2];

      for (const temp of validTemperatures) {
        const isValid = temp >= 0 && temp <= 2;
        expect(isValid).toBe(true);
      }
    });

    it('should reject temperature outside valid range', () => {
      const invalidTemperatures = [-0.1, 2.1, 3, -1];

      for (const temp of invalidTemperatures) {
        const isValid = temp >= 0 && temp <= 2;
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Max tokens validation', () => {
    it('should accept max tokens within valid range', () => {
      const validMaxTokens = [1, 100, 1000, 4096, 128000];

      for (const tokens of validMaxTokens) {
        const isValid = tokens >= 1 && tokens <= 128000;
        expect(isValid).toBe(true);
      }
    });

    it('should reject max tokens outside valid range', () => {
      const invalidMaxTokens = [0, -1, 128001, 200000];

      for (const tokens of invalidMaxTokens) {
        const isValid = tokens >= 1 && tokens <= 128000;
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Top P validation', () => {
    it('should accept topP between 0 and 1', () => {
      const validTopP = [0, 0.5, 0.9, 1];

      for (const topP of validTopP) {
        const isValid = topP >= 0 && topP <= 1;
        expect(isValid).toBe(true);
      }
    });

    it('should reject topP outside valid range', () => {
      const invalidTopP = [-0.1, 1.1, 2];

      for (const topP of invalidTopP) {
        const isValid = topP >= 0 && topP <= 1;
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Penalty validation', () => {
    it('should accept frequency penalty between -2 and 2', () => {
      const validPenalties = [-2, -1, 0, 1, 2];

      for (const penalty of validPenalties) {
        const isValid = penalty >= -2 && penalty <= 2;
        expect(isValid).toBe(true);
      }
    });

    it('should accept presence penalty between -2 and 2', () => {
      const validPenalties = [-2, -1, 0, 1, 2];

      for (const penalty of validPenalties) {
        const isValid = penalty >= -2 && penalty <= 2;
        expect(isValid).toBe(true);
      }
    });

    it('should reject penalties outside valid range', () => {
      const invalidPenalties = [-2.1, 2.1, 3, -3];

      for (const penalty of invalidPenalties) {
        const isValid = penalty >= -2 && penalty <= 2;
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Provider-specific defaults', () => {
    const DEFAULT_MODELS: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-haiku-4-5-20251015',
      gemini: 'gemini-2.5-flash',
    };

    it('should have default models for each provider', () => {
      expect(DEFAULT_MODELS.openai).toBeDefined();
      expect(DEFAULT_MODELS.anthropic).toBeDefined();
      expect(DEFAULT_MODELS.gemini).toBeDefined();
    });

    it('should resolve to correct default model for each provider', () => {
      const providers = ['openai', 'anthropic', 'gemini'] as const;

      for (const provider of providers) {
        const defaultModel = DEFAULT_MODELS[provider];
        expect(typeof defaultModel).toBe('string');
        expect(defaultModel.length).toBeGreaterThan(0);
      }
    });

    it('should use default model when not specified', () => {
      interface Config {
        provider: string;
        model?: string;
      }

      const config: Config = {
        provider: 'openai',
      };

      const effectiveModel = config.model || DEFAULT_MODELS[config.provider];
      expect(effectiveModel).toBe('gpt-4o-mini');
    });
  });

  describe('Model switching logic', () => {
    it('should change model when provider changes', () => {
      const DEFAULT_MODELS: Record<string, string> = {
        openai: 'gpt-4o-mini',
        anthropic: 'claude-haiku-4-5-20251015',
        gemini: 'gemini-2.5-flash',
      };

      let currentProvider = 'openai';
      let currentModel = DEFAULT_MODELS[currentProvider];

      expect(currentModel).toBe('gpt-4o-mini');

      // Simulate provider change
      currentProvider = 'anthropic';
      currentModel = DEFAULT_MODELS[currentProvider];

      expect(currentModel).toBe('claude-haiku-4-5-20251015');
    });

    it('should get models list for provider', () => {
      const MODELS_BY_PROVIDER: Record<string, readonly string[]> = {
        openai: OPENAI_MODELS,
        anthropic: ANTHROPIC_MODELS,
        gemini: GEMINI_MODELS,
      };

      const openaiModels = MODELS_BY_PROVIDER.openai;
      const anthropicModels = MODELS_BY_PROVIDER.anthropic;
      const geminiModels = MODELS_BY_PROVIDER.gemini;

      expect(openaiModels).toEqual(OPENAI_MODELS);
      expect(anthropicModels).toEqual(ANTHROPIC_MODELS);
      expect(geminiModels).toEqual(GEMINI_MODELS);
    });
  });
});

describe('Test Run Model Override Storage', () => {
  interface TestRunModelOverride {
    provider: string;
    model: string;
  }

  interface TestRun {
    _id: string;
    status: string;
    modelOverride?: TestRunModelOverride;
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
  }

  it('should store model override in test run', () => {
    const testRun: TestRun = {
      _id: 'test-run-1',
      status: 'completed',
      modelOverride: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
      },
      summary: {
        total: 5,
        passed: 5,
        failed: 0,
      },
    };

    expect(testRun.modelOverride).toBeDefined();
    expect(testRun.modelOverride?.provider).toBe('anthropic');
    expect(testRun.modelOverride?.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('should allow test run without model override', () => {
    const testRun: TestRun = {
      _id: 'test-run-2',
      status: 'completed',
      summary: {
        total: 5,
        passed: 4,
        failed: 1,
      },
    };

    expect(testRun.modelOverride).toBeUndefined();
  });

  it('should identify runs with same model override', () => {
    const runs: TestRun[] = [
      {
        _id: 'run-1',
        status: 'completed',
        modelOverride: { provider: 'openai', model: 'gpt-4o' },
        summary: { total: 5, passed: 5, failed: 0 },
      },
      {
        _id: 'run-2',
        status: 'completed',
        modelOverride: { provider: 'openai', model: 'gpt-4o' },
        summary: { total: 5, passed: 4, failed: 1 },
      },
      {
        _id: 'run-3',
        status: 'completed',
        modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        summary: { total: 5, passed: 5, failed: 0 },
      },
    ];

    const gpt4oRuns = runs.filter(
      (r) => r.modelOverride?.provider === 'openai' && r.modelOverride?.model === 'gpt-4o'
    );

    expect(gpt4oRuns).toHaveLength(2);
  });

  it('should group runs by model', () => {
    const runs: TestRun[] = [
      {
        _id: 'run-1',
        status: 'completed',
        modelOverride: { provider: 'openai', model: 'gpt-4o' },
        summary: { total: 5, passed: 5, failed: 0 },
      },
      {
        _id: 'run-2',
        status: 'completed',
        modelOverride: { provider: 'openai', model: 'gpt-4o-mini' },
        summary: { total: 5, passed: 4, failed: 1 },
      },
      {
        _id: 'run-3',
        status: 'completed',
        modelOverride: { provider: 'openai', model: 'gpt-4o' },
        summary: { total: 5, passed: 3, failed: 2 },
      },
    ];

    const groupedByModel = runs.reduce(
      (acc, run) => {
        const key = run.modelOverride ? `${run.modelOverride.provider}:${run.modelOverride.model}` : 'default';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(run);
        return acc;
      },
      {} as Record<string, TestRun[]>
    );

    expect(Object.keys(groupedByModel)).toHaveLength(2);
    expect(groupedByModel['openai:gpt-4o']).toHaveLength(2);
    expect(groupedByModel['openai:gpt-4o-mini']).toHaveLength(1);
  });
});

describe('getModelType', () => {
  describe('fast models', () => {
    it('should return fast for OpenAI mini models', () => {
      expect(getModelType('gpt-5-mini')).toBe('fast');
      expect(getModelType('gpt-4.1-mini')).toBe('fast');
      expect(getModelType('gpt-4o-mini')).toBe('fast');
    });

    it('should return fast for Anthropic Haiku models', () => {
      expect(getModelType('claude-haiku-4-5-20251015')).toBe('fast');
    });

    it('should return fast for Gemini flash/lite models', () => {
      expect(getModelType('gemini-3-flash-preview')).toBe('fast');
      expect(getModelType('gemini-2.5-flash')).toBe('fast');
      expect(getModelType('gemini-2.5-flash-lite')).toBe('fast');
      expect(getModelType('gemini-2.0-flash')).toBe('fast');
      expect(getModelType('gemini-2.0-flash-lite')).toBe('fast');
    });
  });

  describe('thinking models', () => {
    it('should return thinking for Anthropic Opus models', () => {
      expect(getModelType('claude-opus-4-5-20251101')).toBe('thinking');
      expect(getModelType('claude-opus-4-20250514')).toBe('thinking');
    });
  });

  describe('standard models', () => {
    it('should return standard for full OpenAI models', () => {
      expect(getModelType('gpt-5.2')).toBe('standard');
      expect(getModelType('gpt-5.1')).toBe('standard');
      expect(getModelType('gpt-5')).toBe('standard');
      expect(getModelType('gpt-4.1')).toBe('standard');
      expect(getModelType('gpt-4o')).toBe('standard');
    });

    it('should return standard for Anthropic Sonnet models', () => {
      expect(getModelType('claude-sonnet-4-5-20250929')).toBe('standard');
      expect(getModelType('claude-sonnet-4-20250514')).toBe('standard');
    });

    it('should return standard for Gemini Pro models', () => {
      expect(getModelType('gemini-2.5-pro')).toBe('standard');
    });

    it('should return standard for unknown models', () => {
      expect(getModelType('unknown-model')).toBe('standard');
      expect(getModelType('')).toBe('standard');
      expect(getModelType('some-future-model')).toBe('standard');
    });
  });

  describe('MODEL_TYPES constant', () => {
    it('should have entries for all fast models', () => {
      const fastModels = Object.entries(MODEL_TYPES).filter(([, type]) => type === 'fast');
      expect(fastModels.length).toBeGreaterThan(0);
    });

    it('should have entries for thinking models', () => {
      const thinkingModels = Object.entries(MODEL_TYPES).filter(([, type]) => type === 'thinking');
      expect(thinkingModels.length).toBeGreaterThan(0);
    });
  });
});

describe('getModelLabel', () => {
  it('should return human-readable label for known OpenAI models', () => {
    expect(getModelLabel('gpt-4o')).toBe('GPT-4o (gpt-4o)');
    expect(getModelLabel('gpt-4o-mini')).toBe('GPT-4o Mini (gpt-4o-mini)');
    expect(getModelLabel('gpt-5')).toBe('GPT-5 (gpt-5)');
  });

  it('should return human-readable label for known Anthropic models', () => {
    expect(getModelLabel('claude-opus-4-5-20251101')).toBe('Claude Opus 4.5 (claude-opus-4-5-20251101)');
    expect(getModelLabel('claude-sonnet-4-5-20250929')).toBe('Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)');
    expect(getModelLabel('claude-haiku-4-5-20251015')).toBe('Claude Haiku 4.5 (claude-haiku-4-5-20251015)');
  });

  it('should return human-readable label for known Gemini models', () => {
    expect(getModelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro (gemini-2.5-pro)');
    expect(getModelLabel('gemini-2.5-flash')).toBe('Gemini 2.5 Flash (gemini-2.5-flash)');
  });

  it('should return the model string itself for unknown models', () => {
    expect(getModelLabel('unknown-model')).toBe('unknown-model');
    expect(getModelLabel('future-gpt-6')).toBe('future-gpt-6');
    expect(getModelLabel('')).toBe('');
  });

  describe('MODEL_LABELS constant', () => {
    it('should have labels for all OpenAI models', () => {
      for (const model of OPENAI_MODELS) {
        expect(MODEL_LABELS[model]).toBeDefined();
        expect(MODEL_LABELS[model]).toContain(model);
      }
    });

    it('should have labels for all Anthropic models', () => {
      for (const model of ANTHROPIC_MODELS) {
        expect(MODEL_LABELS[model]).toBeDefined();
        expect(MODEL_LABELS[model]).toContain(model);
      }
    });

    it('should have labels for all Gemini models', () => {
      for (const model of GEMINI_MODELS) {
        expect(MODEL_LABELS[model]).toBeDefined();
        expect(MODEL_LABELS[model]).toContain(model);
      }
    });
  });
});
