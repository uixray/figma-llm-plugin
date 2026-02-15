/**
 * Tests for settings-migration.ts
 */

import { migrateSettings, MIGRATIONS } from './settings-migration';
import { PluginSettings, DEFAULT_SETTINGS } from './types';

describe('settings-migration', () => {
  describe('migrateSettings', () => {
    it('should return defaults if no settings', () => {
      const result = migrateSettings(null);

      expect(result.version).toBe(DEFAULT_SETTINGS.version);
      expect(result.providerGroups).toEqual([]);
    });

    it('should return defaults if no version', () => {
      const result = migrateSettings({});

      expect(result.version).toBe(DEFAULT_SETTINGS.version);
    });

    it('should keep current settings if already on latest version', () => {
      const currentSettings: PluginSettings = {
        version: 2.1,
        providerGroups: [],
        activeModelId: '',
        generation: {
          temperature: 0.8,
          maxTokens: 1500,
          streaming: true,
        },
        ui: {
          showTokenCount: false,
          showCostEstimate: false,
        },
        language: 'ru',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(currentSettings);

      expect(result.version).toBe(2.1);
      expect(result.generation.temperature).toBe(0.8);
      expect(result.language).toBe('ru');
    });
  });

  describe('V1 → V2 migration', () => {
    it('should migrate LM Studio config', () => {
      const v1Settings = {
        version: '1.0.0',
        activeProvider: 'lmstudio',
        providers: {
          lmstudio: {
            type: 'lmstudio',
            enabled: true,
            name: 'My LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            model: 'local-model',
            useProxy: false,
          },
        },
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
      };

      const result = migrateSettings(v1Settings);

      expect(result.version).toBe(2.1); // Migrates to latest version
      expect(result.providerGroups).toBeDefined();
      expect(result.providerGroups!.length).toBeGreaterThan(0);

      // V2.1: Check provider groups instead of providerConfigs
      const lmGroup = result.providerGroups!.find((g) => g.baseProviderId === 'lmstudio');
      expect(lmGroup).toBeDefined();
      expect(lmGroup!.modelConfigs.length).toBeGreaterThan(0);
    });

    it('should migrate Yandex config', () => {
      const v1Settings = {
        version: '1.0.0',
        activeProvider: 'yandex',
        providers: {
          yandex: {
            type: 'yandex',
            enabled: true,
            name: 'My Yandex',
            folderId: 'b1g123',
            apiKey: 'AQVN...',
            model: 'gpt://b1g123/yandexgpt-lite/latest',
          },
        },
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
      };

      const result = migrateSettings(v1Settings);

      expect(result.version).toBe(2.1); // Migrates to latest version

      // V2.1: Check provider groups instead of providerConfigs
      const yandexGroup = result.providerGroups!.find((g) => g.baseProviderId === 'yandex');
      expect(yandexGroup).toBeDefined();
      expect(yandexGroup!.sharedApiKey).toBe('AQVN...');;
    });

    it('should migrate OpenAI compatible config', () => {
      const v1Settings = {
        version: '1.0.0',
        activeProvider: 'openai-compatible',
        providers: {
          openaiCompatible: {
            type: 'openai-compatible',
            enabled: true,
            name: 'My OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-proj-123',
            model: 'gpt-4o',
          },
        },
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
      };

      const result = migrateSettings(v1Settings);

      expect(result.version).toBe(2.1); // Migrates to latest version

      // V2.1: Check provider groups instead of providerConfigs
      const openaiGroup = result.providerGroups!.find((g) => g.baseProviderId === 'openai');
      expect(openaiGroup).toBeDefined();
      expect(openaiGroup!.sharedApiKey).toBe('sk-proj-123');
    });

    it('should set active provider correctly', () => {
      const v1Settings = {
        version: '1.0.0',
        activeProvider: 'lmstudio',
        providers: {
          lmstudio: {
            type: 'lmstudio',
            enabled: true,
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            model: 'local',
            useProxy: false,
          },
        },
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
      };

      const result = migrateSettings(v1Settings);

      // V2.1: Uses activeModelId instead of activeProviderId
      expect(result.activeModelId).toBeDefined();
    });
  });

  describe('V2 → V2.1 migration', () => {
    it('should create groups from provider configs', () => {
      const v2Settings = {
        version: 2,
        providerConfigs: [
          {
            id: 'config-1',
            baseConfigId: 'openai-gpt4o',
            name: 'GPT-4o',
            apiKey: 'sk-test-123',
            enabled: true,
            createdAt: Date.now(),
          },
          {
            id: 'config-2',
            baseConfigId: 'openai-gpt4o-mini',
            name: 'GPT-4o Mini',
            apiKey: 'sk-test-123', // Same key
            enabled: true,
            createdAt: Date.now(),
          },
        ],
        activeProviderId: 'config-1',
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
        ui: {
          showTokenCount: true,
          showCostEstimate: true,
        },
        language: 'en',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(v2Settings);

      expect(result.version).toBe(2.1);
      expect(result.providerGroups).toBeDefined();
      expect(result.providerGroups!.length).toBe(1); // Same key = one group

      const group = result.providerGroups![0];
      expect(group.modelConfigs).toHaveLength(2);
      expect(group.sharedApiKey).toBe('sk-test-123');
      expect(group.baseProviderId).toBe('openai');
    });

    it('should create separate groups for different keys', () => {
      const v2Settings = {
        version: 2,
        providerConfigs: [
          {
            id: 'config-1',
            baseConfigId: 'openai-gpt4o',
            name: 'GPT-4o Prod',
            apiKey: 'sk-prod-123',
            enabled: true,
            createdAt: Date.now(),
          },
          {
            id: 'config-2',
            baseConfigId: 'openai-gpt4o-mini',
            name: 'GPT-4o Mini Dev',
            apiKey: 'sk-dev-456', // Different key
            enabled: true,
            createdAt: Date.now(),
          },
        ],
        activeProviderId: 'config-1',
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
        ui: {
          showTokenCount: true,
          showCostEstimate: true,
        },
        language: 'en',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(v2Settings);

      expect(result.version).toBe(2.1);
      expect(result.providerGroups!.length).toBe(2); // Different keys = two groups
    });

    it('should preserve activeModelId', () => {
      const v2Settings = {
        version: 2,
        providerConfigs: [
          {
            id: 'config-1',
            baseConfigId: 'claude-35-sonnet',
            name: 'Claude Sonnet',
            apiKey: 'sk-ant-123',
            enabled: true,
            createdAt: Date.now(),
          },
        ],
        activeProviderId: 'config-1',
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
        ui: {
          showTokenCount: true,
          showCostEstimate: true,
        },
        language: 'en',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(v2Settings);

      expect(result.activeModelId).toBe('config-1');
    });

    it('should handle empty provider configs', () => {
      const v2Settings = {
        version: 2,
        providerConfigs: [],
        activeProviderId: '',
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
        ui: {
          showTokenCount: true,
          showCostEstimate: true,
        },
        language: 'en',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(v2Settings);

      expect(result.version).toBe(2.1);
      expect(result.providerGroups).toEqual([]);
      expect(result.activeModelId).toBe('');
    });

    it('should preserve folderId for Yandex groups', () => {
      const v2Settings = {
        version: 2,
        providerConfigs: [
          {
            id: 'yandex-1',
            baseConfigId: 'yandex-gpt5-lite',
            name: 'Yandex Lite',
            apiKey: 'AQVN123',
            folderId: 'b1g456',
            enabled: true,
            createdAt: Date.now(),
          },
        ],
        activeProviderId: 'yandex-1',
        generation: {
          temperature: 0.7,
          maxTokens: 2000,
          streaming: true,
        },
        ui: {
          showTokenCount: true,
          showCostEstimate: true,
        },
        language: 'en',
        lastUpdated: Date.now(),
      };

      const result = migrateSettings(v2Settings);

      expect(result.providerGroups![0].folderId).toBe('b1g456');
    });
  });

  describe('MIGRATIONS array', () => {
    it('should have correct migration definitions', () => {
      expect(MIGRATIONS).toHaveLength(2);

      expect(MIGRATIONS[0].from).toBe('1.0.0');
      expect(MIGRATIONS[0].to).toBe(2);

      expect(MIGRATIONS[1].from).toBe(2);
      expect(MIGRATIONS[1].to).toBe(2.1);
    });
  });
});
