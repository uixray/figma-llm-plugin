import type { ProviderGroup, ModelConfig, UserProviderConfig } from './types';

/**
 * Convert ProviderGroup V2.1 system to Legacy UserProviderConfig format
 * This allows api-client.ts to work with both systems during migration
 */
export function convertGroupToLegacyConfigs(group: ProviderGroup): UserProviderConfig[] {
  if (!group.enabled) {
    return [];
  }

  const configs: UserProviderConfig[] = [];

  for (const model of group.modelConfigs) {
    if (!model.enabled) {
      continue;
    }

    const config: UserProviderConfig = {
      id: model.id, // Use model.id as providerId
      baseConfigId: model.baseConfigId,
      name: model.name,
      apiKey: group.baseProviderId === 'lmstudio' ? 'not-required' : group.sharedApiKey,
      customUrl: group.baseProviderId === 'lmstudio' ? group.customUrl : model.customUrl,
      folderId: group.folderId,
      modelName: model.modelName,
      customPricing: model.customPricing,
      enabled: model.enabled && group.enabled,
      createdAt: group.createdAt,
      lastUsed: model.lastUsed || group.lastUsed,
    };

    configs.push(config);
  }

  return configs;
}

/**
 * Convert all ProviderGroups to Legacy format
 */
export function convertAllGroupsToLegacy(groups: ProviderGroup[]): UserProviderConfig[] {
  const allConfigs: UserProviderConfig[] = [];

  for (const group of groups) {
    const groupConfigs = convertGroupToLegacyConfigs(group);
    allConfigs.push(...groupConfigs);
  }

  return allConfigs;
}

/**
 * Get all available provider configs from both Legacy and Provider Groups
 */
export function getAllProviderConfigs(
  legacyConfigs: UserProviderConfig[],
  groups: ProviderGroup[]
): UserProviderConfig[] {
  const groupConfigs = convertAllGroupsToLegacy(groups);
  return [...legacyConfigs, ...groupConfigs];
}
