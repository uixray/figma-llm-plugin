/**
 * Tests for provider-groups-utils.ts
 */

import {
  getActiveModels,
  getAllModels,
  findGroupByModelId,
  findModelById,
  modelToUserConfig,
  createProviderGroup,
  addModelToGroup,
  removeModelFromGroup,
  updateModelInGroup,
  getAvailableModelsForGroup,
  canDeleteGroup,
  getGroupStats,
} from './provider-groups-utils';
import { PluginSettings, ProviderGroup, ModelConfig } from './types';

describe('provider-groups-utils', () => {
  // Mock data
  const mockModelConfig1: ModelConfig = {
    id: 'model-1',
    baseConfigId: 'openai-gpt4o',
    name: 'GPT-4o Production',
    enabled: true,
  };

  const mockModelConfig2: ModelConfig = {
    id: 'model-2',
    baseConfigId: 'openai-gpt4o-mini',
    name: 'GPT-4o Mini Dev',
    enabled: false,
  };

  const mockModelConfig3: ModelConfig = {
    id: 'model-3',
    baseConfigId: 'claude-35-sonnet',
    name: 'Claude Sonnet',
    enabled: true,
  };

  const mockGroup1: ProviderGroup = {
    id: 'group-1',
    name: 'My OpenAI',
    baseProviderId: 'openai',
    sharedApiKey: 'sk-test-123',
    modelConfigs: [mockModelConfig1, mockModelConfig2],
    enabled: true,
    createdAt: Date.now(),
  };

  const mockGroup2: ProviderGroup = {
    id: 'group-2',
    name: 'My Claude',
    baseProviderId: 'claude',
    sharedApiKey: 'sk-ant-456',
    modelConfigs: [mockModelConfig3],
    enabled: true,
    createdAt: Date.now(),
  };

  const mockGroup3Disabled: ProviderGroup = {
    id: 'group-3',
    name: 'Disabled Group',
    baseProviderId: 'yandex',
    sharedApiKey: 'test-key',
    modelConfigs: [
      {
        id: 'model-4',
        baseConfigId: 'yandex-gpt5-lite',
        name: 'Yandex Lite',
        enabled: true,
      },
    ],
    enabled: false,
    createdAt: Date.now(),
  };

  const mockSettings: PluginSettings = {
    version: 2.1,
    providerGroups: [mockGroup1, mockGroup2, mockGroup3Disabled],
    activeModelId: 'model-1',
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

  describe('getActiveModels', () => {
    it('should return only enabled models from enabled groups', () => {
      const activeModels = getActiveModels(mockSettings);

      expect(activeModels).toHaveLength(2);
      expect(activeModels[0].id).toBe('model-1');
      expect(activeModels[1].id).toBe('model-3');
    });

    it('should return empty array if no groups', () => {
      const settings = { ...mockSettings, providerGroups: [] };
      const activeModels = getActiveModels(settings);

      expect(activeModels).toHaveLength(0);
    });

    it('should skip disabled models even in enabled groups', () => {
      const activeModels = getActiveModels(mockSettings);

      expect(activeModels.find((m) => m.id === 'model-2')).toBeUndefined();
    });
  });

  describe('getAllModels', () => {
    it('should return all models including disabled', () => {
      const allModels = getAllModels(mockSettings);

      expect(allModels).toHaveLength(4);
    });

    it('should return empty array if no groups', () => {
      const settings = { ...mockSettings, providerGroups: [] };
      const allModels = getAllModels(settings);

      expect(allModels).toHaveLength(0);
    });
  });

  describe('findGroupByModelId', () => {
    it('should find group by model ID', () => {
      const group = findGroupByModelId(mockSettings, 'model-1');

      expect(group).toBeDefined();
      expect(group!.id).toBe('group-1');
    });

    it('should return null if model not found', () => {
      const group = findGroupByModelId(mockSettings, 'non-existent');

      expect(group).toBeNull();
    });

    it('should return null if no groups', () => {
      const settings = { ...mockSettings, providerGroups: undefined };
      const group = findGroupByModelId(settings, 'model-1');

      expect(group).toBeNull();
    });
  });

  describe('findModelById', () => {
    it('should find model and group by model ID', () => {
      const result = findModelById(mockSettings, 'model-3');

      expect(result).toBeDefined();
      expect(result!.model.id).toBe('model-3');
      expect(result!.group.id).toBe('group-2');
    });

    it('should return null if model not found', () => {
      const result = findModelById(mockSettings, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('modelToUserConfig', () => {
    it('should convert model+group to UserProviderConfig', () => {
      const config = modelToUserConfig(mockGroup1, mockModelConfig1);

      expect(config.id).toBe('model-1');
      expect(config.baseConfigId).toBe('openai-gpt4o');
      expect(config.name).toBe('GPT-4o Production');
      expect(config.apiKey).toBe('sk-test-123');
      expect(config.enabled).toBe(true);
    });

    it('should respect both model and group enabled state', () => {
      const config = modelToUserConfig(mockGroup3Disabled, mockGroup3Disabled.modelConfigs[0]);

      expect(config.enabled).toBe(false); // model enabled but group disabled
    });

    it('should include folderId if present', () => {
      const groupWithFolder = { ...mockGroup1, folderId: 'b1g123' };
      const config = modelToUserConfig(groupWithFolder, mockModelConfig1);

      expect(config.folderId).toBe('b1g123');
    });
  });

  describe('createProviderGroup', () => {
    it('should create new provider group', () => {
      const group = createProviderGroup({
        name: 'Test Group',
        baseProviderId: 'openai',
        apiKey: 'sk-test',
        modelIds: ['openai-gpt4o', 'openai-gpt4o-mini'],
      });

      expect(group.name).toBe('Test Group');
      expect(group.baseProviderId).toBe('openai');
      expect(group.sharedApiKey).toBe('sk-test');
      expect(group.modelConfigs).toHaveLength(2);
      expect(group.enabled).toBe(true);
      expect(group.id).toMatch(/^group-/);
    });

    it('should throw error if base config not found', () => {
      expect(() => {
        createProviderGroup({
          name: 'Test',
          baseProviderId: 'openai',
          apiKey: 'sk-test',
          modelIds: ['non-existent-model'],
        });
      }).toThrow('Base config not found');
    });
  });

  describe('addModelToGroup', () => {
    it('should add model to group', () => {
      const updatedGroup = addModelToGroup(mockGroup2, 'claude-opus-45');

      expect(updatedGroup.modelConfigs).toHaveLength(2);
      expect(updatedGroup.modelConfigs[1].baseConfigId).toBe('claude-opus-45');
    });

    it('should throw error if model already exists', () => {
      expect(() => {
        addModelToGroup(mockGroup1, 'openai-gpt4o'); // already exists
      }).toThrow('already exists in group');
    });

    it('should throw error if base config not found', () => {
      expect(() => {
        addModelToGroup(mockGroup1, 'non-existent');
      }).toThrow('Base config not found');
    });
  });

  describe('removeModelFromGroup', () => {
    it('should remove model from group', () => {
      const updatedGroup = removeModelFromGroup(mockGroup1, 'model-2');

      expect(updatedGroup.modelConfigs).toHaveLength(1);
      expect(updatedGroup.modelConfigs[0].id).toBe('model-1');
    });

    it('should not fail if model not found', () => {
      const updatedGroup = removeModelFromGroup(mockGroup1, 'non-existent');

      expect(updatedGroup.modelConfigs).toHaveLength(2);
    });
  });

  describe('updateModelInGroup', () => {
    it('should update model in group', () => {
      const updatedGroup = updateModelInGroup(mockGroup1, 'model-1', {
        name: 'Updated Name',
        enabled: false,
      });

      const updatedModel = updatedGroup.modelConfigs.find((m) => m.id === 'model-1');
      expect(updatedModel!.name).toBe('Updated Name');
      expect(updatedModel!.enabled).toBe(false);
    });

    it('should not affect other models', () => {
      const updatedGroup = updateModelInGroup(mockGroup1, 'model-1', { name: 'Updated' });

      expect(updatedGroup.modelConfigs.find((m) => m.id === 'model-2')!.name).toBe(
        'GPT-4o Mini Dev'
      );
    });
  });

  describe('getAvailableModelsForGroup', () => {
    it('should return models not in group', () => {
      const available = getAvailableModelsForGroup(mockGroup1);

      // Should not include openai-gpt4o and openai-gpt4o-mini (already in group)
      expect(available.find((m) => m.id === 'openai-gpt4o')).toBeUndefined();
      expect(available.find((m) => m.id === 'openai-gpt4o-mini')).toBeUndefined();

      // Should not include non-OpenAI models
      expect(available.find((m) => m.provider === 'claude')).toBeUndefined();
    });

    it('should return empty array if all models added', () => {
      // Create group with all OpenAI models
      const groupWithAllModels = {
        ...mockGroup1,
        modelConfigs: [
          { id: '1', baseConfigId: 'openai-gpt4o', name: 'GPT-4o', enabled: true },
          { id: '2', baseConfigId: 'openai-gpt4o-mini', name: 'GPT-4o Mini', enabled: true },
        ],
      };

      const available = getAvailableModelsForGroup(groupWithAllModels);

      expect(available.length).toBeLessThanOrEqual(0);
    });
  });

  describe('canDeleteGroup', () => {
    it('should allow delete if other active groups exist', () => {
      const canDelete = canDeleteGroup(mockSettings, 'group-1');

      expect(canDelete).toBe(true); // group-2 is active
    });

    it('should not allow delete if no other active groups', () => {
      const settingsOneGroup = {
        ...mockSettings,
        providerGroups: [mockGroup1],
      };

      const canDelete = canDeleteGroup(settingsOneGroup, 'group-1');

      expect(canDelete).toBe(false);
    });

    it('should allow delete if no groups', () => {
      const settingsNoGroups = {
        ...mockSettings,
        providerGroups: undefined,
      };

      const canDelete = canDeleteGroup(settingsNoGroups, 'group-1');

      expect(canDelete).toBe(true);
    });
  });

  describe('getGroupStats', () => {
    it('should return correct stats', () => {
      const stats = getGroupStats(mockGroup1);

      expect(stats.totalModels).toBe(2);
      expect(stats.enabledModels).toBe(1); // only model-1 is enabled
    });

    it('should include lastUsed if present', () => {
      const groupWithLastUsed = { ...mockGroup1, lastUsed: 123456 };
      const stats = getGroupStats(groupWithLastUsed);

      expect(stats.lastUsed).toBe(123456);
    });
  });
});
