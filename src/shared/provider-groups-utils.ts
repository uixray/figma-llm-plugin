/**
 * Вспомогательные функции для работы с Provider Groups (V2.1)
 */

import {
  ProviderGroup,
  ModelConfig,
  PluginSettings,
  UserProviderConfig,
} from './types';
import { PROVIDER_CONFIGS, ProviderConfig } from './providers';

/**
 * Получить все активные модели из всех групп
 */
export function getActiveModels(settings: PluginSettings): ModelConfig[] {
  if (!settings.providerGroups || settings.providerGroups.length === 0) {
    return [];
  }

  const models: ModelConfig[] = [];

  for (const group of settings.providerGroups) {
    if (!group.enabled) continue;

    for (const model of group.modelConfigs) {
      if (model.enabled) {
        models.push(model);
      }
    }
  }

  return models;
}

/**
 * Получить все модели из всех групп (включая неактивные)
 */
export function getAllModels(settings: PluginSettings): ModelConfig[] {
  if (!settings.providerGroups || settings.providerGroups.length === 0) {
    return [];
  }

  const models: ModelConfig[] = [];

  for (const group of settings.providerGroups) {
    models.push(...group.modelConfigs);
  }

  return models;
}

/**
 * Найти группу по ID модели
 */
export function findGroupByModelId(
  settings: PluginSettings,
  modelId: string
): ProviderGroup | null {
  if (!settings.providerGroups) return null;

  for (const group of settings.providerGroups) {
    if (group.modelConfigs.some((m) => m.id === modelId)) {
      return group;
    }
  }

  return null;
}

/**
 * Найти модель по ID
 */
export function findModelById(
  settings: PluginSettings,
  modelId: string
): { group: ProviderGroup; model: ModelConfig } | null {
  if (!settings.providerGroups) return null;

  for (const group of settings.providerGroups) {
    const model = group.modelConfigs.find((m) => m.id === modelId);
    if (model) {
      return { group, model };
    }
  }

  return null;
}

/**
 * Получить UserProviderConfig из ModelConfig и ProviderGroup
 * (для обратной совместимости с провайдерами V2.0)
 */
export function modelToUserConfig(
  group: ProviderGroup,
  model: ModelConfig
): UserProviderConfig {
  // For LM Studio: URL is stored on group.customUrl (shared for all models)
  // For "other" custom providers: URL is stored on model.customUrl
  // For all others: model.customUrl (if any override)
  const resolvedCustomUrl =
    group.baseProviderId === 'lmstudio' ? group.customUrl :
    group.baseProviderId === 'other' ? model.customUrl :
    model.customUrl;

  return {
    id: model.id,
    baseConfigId: model.baseConfigId,
    name: model.name,
    apiKey: group.baseProviderId === 'lmstudio' ? 'not-required' : group.sharedApiKey,
    customPricing: model.customPricing,
    customUrl: resolvedCustomUrl,
    folderId: group.folderId,
    modelName: model.modelName,
    enabled: model.enabled && group.enabled,
    createdAt: group.createdAt,
    lastUsed: model.lastUsed,
  };
}

/**
 * Получить базовую конфигурацию провайдера по ID модели
 */
export function getBaseConfigForModel(modelId: string): ProviderConfig | null {
  const allModels = PROVIDER_CONFIGS;

  for (const config of allModels) {
    if (config.id === modelId) {
      return config;
    }
  }

  return null;
}

/**
 * Создать новую группу провайдеров
 */
export function createProviderGroup(params: {
  name: string;
  baseProviderId: string;
  apiKey: string;
  modelIds: string[]; // IDs из PROVIDER_CONFIGS
  folderId?: string;
}): ProviderGroup {
  const modelConfigs: ModelConfig[] = params.modelIds.map((configId) => {
    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === configId);
    if (!baseConfig) {
      throw new Error(`Base config not found: ${configId}`);
    }

    return {
      id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      baseConfigId: configId,
      name: baseConfig.name,
      enabled: true,
    };
  });

  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: params.name,
    baseProviderId: params.baseProviderId,
    sharedApiKey: params.apiKey,
    folderId: params.folderId,
    modelConfigs,
    enabled: true,
    createdAt: Date.now(),
  };
}

/**
 * Добавить модель в существующую группу
 */
export function addModelToGroup(
  group: ProviderGroup,
  baseConfigId: string
): ProviderGroup {
  const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === baseConfigId);
  if (!baseConfig) {
    throw new Error(`Base config not found: ${baseConfigId}`);
  }

  // Проверяем что модель с таким baseConfigId еще нет в группе
  if (group.modelConfigs.some((m) => m.baseConfigId === baseConfigId)) {
    throw new Error(`Model ${baseConfigId} already exists in group`);
  }

  const newModel: ModelConfig = {
    id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    baseConfigId,
    name: baseConfig.name,
    enabled: true,
  };

  return {
    ...group,
    modelConfigs: [...group.modelConfigs, newModel],
  };
}

/**
 * Удалить модель из группы
 */
export function removeModelFromGroup(
  group: ProviderGroup,
  modelId: string
): ProviderGroup {
  return {
    ...group,
    modelConfigs: group.modelConfigs.filter((m) => m.id !== modelId),
  };
}

/**
 * Обновить модель в группе
 */
export function updateModelInGroup(
  group: ProviderGroup,
  modelId: string,
  updates: Partial<ModelConfig>
): ProviderGroup {
  return {
    ...group,
    modelConfigs: group.modelConfigs.map((m) =>
      m.id === modelId ? { ...m, ...updates } : m
    ),
  };
}

/**
 * Получить список моделей доступных для добавления в группу
 * (модели того же провайдера, которых еще нет в группе)
 */
export function getAvailableModelsForGroup(group: ProviderGroup): ProviderConfig[] {
  const existingConfigIds = new Set(group.modelConfigs.map((m) => m.baseConfigId));

  return PROVIDER_CONFIGS.filter(
    (config) => config.provider === group.baseProviderId && !existingConfigIds.has(config.id)
  );
}

/**
 * Проверить можно ли удалить группу (нужна хотя бы одна активная модель в системе)
 */
export function canDeleteGroup(settings: PluginSettings, groupId: string): boolean {
  if (!settings.providerGroups) return true;

  const otherGroups = settings.providerGroups.filter((g) => g.id !== groupId);

  // Проверяем что есть хотя бы одна активная модель в других группах
  for (const group of otherGroups) {
    if (group.enabled && group.modelConfigs.some((m) => m.enabled)) {
      return true;
    }
  }

  return false;
}

/**
 * Получить статистику по группе
 */
export function getGroupStats(group: ProviderGroup): {
  totalModels: number;
  enabledModels: number;
  lastUsed?: number;
} {
  return {
    totalModels: group.modelConfigs.length,
    enabledModels: group.modelConfigs.filter((m) => m.enabled).length,
    lastUsed: group.lastUsed,
  };
}
