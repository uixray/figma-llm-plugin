import { PROVIDER_CONFIGS, ProviderConfig } from './providers';

describe('PROVIDER_CONFIGS', () => {
  it('should have at least 10 provider configurations', () => {
    expect(PROVIDER_CONFIGS.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique IDs', () => {
    const ids = PROVIDER_CONFIGS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have required fields for all providers', () => {
    for (const config of PROVIDER_CONFIGS) {
      expect(config.id).toBeTruthy();
      expect(config.name).toBeTruthy();
      expect(config.provider).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.model).toBeTruthy();
      expect(config.apiUrl).toBeTruthy();
      expect(typeof config.requiresProxy).toBe('boolean');
      expect(config.pricing).toBeDefined();
      expect(typeof config.pricing.input).toBe('number');
      expect(typeof config.pricing.output).toBe('number');
    }
  });

  it('should have non-negative pricing', () => {
    for (const config of PROVIDER_CONFIGS) {
      expect(config.pricing.input).toBeGreaterThanOrEqual(0);
      expect(config.pricing.output).toBeGreaterThanOrEqual(0);
    }
  });

  describe('provider types', () => {
    const providerTypes = [...new Set(PROVIDER_CONFIGS.map(p => p.provider))];

    it('should include key providers', () => {
      expect(providerTypes).toContain('openai');
      expect(providerTypes).toContain('claude');
      expect(providerTypes).toContain('gemini');
      expect(providerTypes).toContain('lmstudio');
    });

    it('should have multiple models for OpenAI', () => {
      const openaiModels = PROVIDER_CONFIGS.filter(p => p.provider === 'openai');
      expect(openaiModels.length).toBeGreaterThanOrEqual(2);
    });

    it('should have multiple models for Claude', () => {
      const claudeModels = PROVIDER_CONFIGS.filter(p => p.provider === 'claude');
      expect(claudeModels.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('LM Studio config', () => {
    it('should have free pricing for LM Studio', () => {
      const lmStudio = PROVIDER_CONFIGS.filter(p => p.provider === 'lmstudio');
      expect(lmStudio.length).toBeGreaterThan(0);
      for (const cfg of lmStudio) {
        expect(cfg.pricing.input).toBe(0);
        expect(cfg.pricing.output).toBe(0);
      }
    });

    it('should not require proxy for LM Studio', () => {
      const lmStudio = PROVIDER_CONFIGS.filter(p => p.provider === 'lmstudio');
      for (const cfg of lmStudio) {
        expect(cfg.requiresProxy).toBe(false);
      }
    });
  });

  describe('model names', () => {
    it('should have realistic model identifiers', () => {
      const openaiGpt4 = PROVIDER_CONFIGS.find(p => p.id === 'openai-gpt4o');
      if (openaiGpt4) {
        expect(openaiGpt4.model).toContain('gpt-4o');
      }
    });
  });

  describe('cost calculation', () => {
    it('should allow calculating cost from pricing', () => {
      const gpt4o = PROVIDER_CONFIGS.find(p => p.id === 'openai-gpt4o');
      if (gpt4o) {
        // 1000 tokens = 1000/1M * price_per_million
        const inputCost = (1000 / 1_000_000) * gpt4o.pricing.input;
        const outputCost = (1000 / 1_000_000) * gpt4o.pricing.output;
        expect(inputCost).toBeGreaterThan(0);
        expect(outputCost).toBeGreaterThan(0);
        expect(outputCost).toBeGreaterThanOrEqual(inputCost); // Output typically costs more
      }
    });

    it('should calculate zero cost for free providers', () => {
      const freeProviders = PROVIDER_CONFIGS.filter(
        p => p.pricing.input === 0 && p.pricing.output === 0
      );
      expect(freeProviders.length).toBeGreaterThan(0);
      for (const p of freeProviders) {
        const cost = (1000 / 1_000_000) * (p.pricing.input + p.pricing.output) / 2;
        expect(cost).toBe(0);
      }
    });
  });
});
