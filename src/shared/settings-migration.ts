import {
  PluginSettings,
  DEFAULT_SETTINGS,
  UserProviderConfig,
  ProviderType,
  ProviderGroup,
  ModelConfig,
} from './types';
import { PROVIDER_CONFIGS } from './providers';

/**
 * Схема миграции настроек
 */
export interface SettingsMigration {
  from: string | number;
  to: string | number;
  migrate: (old: any) => PluginSettings;
}

/**
 * Миграция с версии 1.0.0 (старая архитектура) на версию 2 (мультипровайдерная)
 */
function migrateV1ToV2(oldSettings: any): PluginSettings {
  console.log('[Migration] Starting v1 → v2 migration');

  const providerConfigs: UserProviderConfig[] = [];

  // Конвертируем старые настройки провайдеров в новые конфигурации

  // 1. LM Studio
  if (oldSettings.providers?.lmstudio?.enabled) {
    const lmConfig = oldSettings.providers.lmstudio;
    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === 'lmstudio-custom');

    if (baseConfig) {
      providerConfigs.push({
        id: 'migrated-lmstudio',
        baseConfigId: baseConfig.id,
        name: lmConfig.name || 'LM Studio (migrated)',
        apiKey: '', // LM Studio не требует API ключа
        customUrl: lmConfig.baseUrl,
        enabled: true,
        createdAt: Date.now(),
      });
      console.log('[Migration] Migrated LM Studio config');
    }
  }

  // 2. Yandex Cloud
  if (oldSettings.providers?.yandex?.enabled && oldSettings.providers.yandex.apiKey) {
    const yandexConfig = oldSettings.providers.yandex;

    // Определяем какая модель Yandex использовалась
    let baseConfigId = 'yandex-gpt5-lite'; // дефолт

    if (yandexConfig.model) {
      // Пытаемся найти соответствующую конфигурацию по модели
      if (yandexConfig.model.includes('yandexgpt-lite')) {
        baseConfigId = 'yandex-gpt5-lite';
      } else if (yandexConfig.model.includes('yandexgpt/')) {
        baseConfigId = 'yandex-gpt5-pro';
      } else if (yandexConfig.model.includes('yandexgpt-51')) {
        baseConfigId = 'yandex-gpt51-pro';
      }
    }

    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === baseConfigId);

    if (baseConfig) {
      providerConfigs.push({
        id: 'migrated-yandex',
        baseConfigId: baseConfig.id,
        name: yandexConfig.name || 'Yandex Cloud (migrated)',
        apiKey: yandexConfig.apiKey,
        folderId: yandexConfig.folderId, // ← preserve Folder ID (required for Yandex API)
        enabled: true,
        createdAt: Date.now(),
      });
      console.log('[Migration] Migrated Yandex config with model:', baseConfigId);
    }
  }

  // 3. OpenAI Compatible
  if (
    oldSettings.providers?.openaiCompatible?.enabled &&
    oldSettings.providers.openaiCompatible.apiKey
  ) {
    const openaiConfig = oldSettings.providers.openaiCompatible;

    // Определяем тип провайдера по URL
    let baseConfigId = 'openai-gpt4o-mini'; // дефолт

    if (openaiConfig.baseUrl) {
      const url = openaiConfig.baseUrl.toLowerCase();

      if (url.includes('api.openai.com')) {
        // Официальный OpenAI
        if (openaiConfig.model?.includes('gpt-4o-mini')) {
          baseConfigId = 'openai-gpt4o-mini';
        } else if (openaiConfig.model?.includes('gpt-4o')) {
          baseConfigId = 'openai-gpt4o';
        }
      }
      // Для других OpenAI-compatible серверов используем дефолт
    }

    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === baseConfigId);

    if (baseConfig) {
      providerConfigs.push({
        id: 'migrated-openai',
        baseConfigId: baseConfig.id,
        name: openaiConfig.name || 'OpenAI (migrated)',
        apiKey: openaiConfig.apiKey,
        customUrl: openaiConfig.baseUrl !== baseConfig.apiUrl ? openaiConfig.baseUrl : undefined,
        enabled: true,
        createdAt: Date.now(),
      });
      console.log('[Migration] Migrated OpenAI config');
    }
  }

  // Определяем активную конфигурацию
  let activeProviderId = '';
  if (providerConfigs.length > 0) {
    // Пытаемся найти конфигурацию которая соответствует старому activeProvider
    const oldActiveType = oldSettings.activeProvider as ProviderType;

    if (oldActiveType === 'lmstudio') {
      activeProviderId = providerConfigs.find((c) => c.id === 'migrated-lmstudio')?.id || '';
    } else if (oldActiveType === 'yandex') {
      activeProviderId = providerConfigs.find((c) => c.id === 'migrated-yandex')?.id || '';
    } else if (oldActiveType === 'openai-compatible') {
      activeProviderId = providerConfigs.find((c) => c.id === 'migrated-openai')?.id || '';
    }

    // Если не нашли, берём первую доступную
    if (!activeProviderId) {
      activeProviderId = providerConfigs[0].id;
    }
  }

  console.log(
    `[Migration] Created ${providerConfigs.length} provider configs, active: ${activeProviderId}`
  );

  // Создаём новые настройки
  const migratedSettings: PluginSettings = {
    version: 2,
    providerConfigs,
    activeProviderId,
    generation: oldSettings.generation || DEFAULT_SETTINGS.generation,
    ui: {
      showTokenCount: true,
      showCostEstimate: true,
      lastActiveTab: undefined,
    },
    language: 'en', // дефолт
    lastUpdated: Date.now(),
  };

  console.log('[Migration] v1 → v2 migration completed successfully');
  return migratedSettings;
}

/**
 * Миграция с версии 2 (отдельные конфигурации) на версию 2.1 (группы провайдеров)
 */
function migrateV2ToV21(oldSettings: any): PluginSettings {
  console.log('[Migration] Starting v2 → v2.1 migration');

  const providerGroups: ProviderGroup[] = [];

  if (!oldSettings.providerConfigs || oldSettings.providerConfigs.length === 0) {
    console.log('[Migration] No provider configs to migrate');
    return {
      ...oldSettings,
      version: 2.1,
      providerGroups: [],
      activeModelId: '',
    };
  }

  // Группируем конфигурации по baseProviderId (определяем по baseConfigId)
  const configsByProvider: Map<string, UserProviderConfig[]> = new Map();

  for (const config of oldSettings.providerConfigs) {
    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === config.baseConfigId);
    if (!baseConfig) continue;

    const providerId = baseConfig.provider; // 'openai', 'claude', 'yandex', и т.д.

    if (!configsByProvider.has(providerId)) {
      configsByProvider.set(providerId, []);
    }
    configsByProvider.get(providerId)!.push(config);
  }

  console.log(`[Migration] Found ${configsByProvider.size} unique providers`);

  // Создаём группу для каждого провайдера
  let activeModelId = '';

  for (const [providerId, configs] of configsByProvider.entries()) {
    // Если все конфигурации этого провайдера имеют одинаковый API ключ - создаём одну группу
    // Иначе - создаём отдельную группу для каждой конфигурации

    const apiKeys = [...new Set(configs.map((c) => c.apiKey))];

    if (apiKeys.length === 1) {
      // Все конфигурации с одним ключом - создаём одну группу
      const firstConfig = configs[0];
      const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === firstConfig.baseConfigId);
      if (!baseConfig) continue;

      const modelConfigs: ModelConfig[] = configs.map((config) => ({
        id: config.id,
        baseConfigId: config.baseConfigId,
        name: config.name,
        enabled: config.enabled,
        customPricing: config.customPricing,
        customUrl: config.customUrl,
        modelName: config.modelName,
        lastUsed: config.lastUsed,
      }));

      const group: ProviderGroup = {
        id: `group-${providerId}-${Date.now()}`,
        name: `${baseConfig.name} (migrated)`,
        baseProviderId: providerId,
        sharedApiKey: firstConfig.apiKey,
        folderId: firstConfig.folderId,
        modelConfigs,
        enabled: configs.some((c) => c.enabled),
        createdAt: firstConfig.createdAt,
        lastUsed: Math.max(...configs.map((c) => c.lastUsed || 0)),
      };

      providerGroups.push(group);

      // Если был активным - запоминаем первую модель группы
      if (oldSettings.activeProviderId && configs.some((c) => c.id === oldSettings.activeProviderId)) {
        activeModelId = modelConfigs.find((m) => m.enabled)?.id || modelConfigs[0]?.id || '';
      }

      console.log(`[Migration] Created group for ${providerId} with ${modelConfigs.length} models`);
    } else {
      // Разные ключи - создаём отдельную группу для каждой конфигурации
      for (const config of configs) {
        const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === config.baseConfigId);
        if (!baseConfig) continue;

        const modelConfig: ModelConfig = {
          id: config.id,
          baseConfigId: config.baseConfigId,
          name: config.name,
          enabled: config.enabled,
          customPricing: config.customPricing,
          customUrl: config.customUrl,
          modelName: config.modelName,
          lastUsed: config.lastUsed,
        };

        const group: ProviderGroup = {
          id: `group-${config.id}`,
          name: config.name,
          baseProviderId: providerId,
          sharedApiKey: config.apiKey,
          folderId: config.folderId,
          modelConfigs: [modelConfig],
          enabled: config.enabled,
          createdAt: config.createdAt,
          lastUsed: config.lastUsed,
        };

        providerGroups.push(group);

        if (config.id === oldSettings.activeProviderId) {
          activeModelId = modelConfig.id;
        }

        console.log(`[Migration] Created individual group for ${config.name}`);
      }
    }
  }

  console.log(
    `[Migration] Created ${providerGroups.length} provider groups, active model: ${activeModelId}`
  );

  // Создаём новые настройки
  const migratedSettings: PluginSettings = {
    ...oldSettings,
    version: 2.1,
    providerGroups,
    activeModelId,
    // Сохраняем старые поля для обратной совместимости
    providerConfigs: oldSettings.providerConfigs,
    activeProviderId: oldSettings.activeProviderId,
  };

  console.log('[Migration] v2 → v2.1 migration completed successfully');
  return migratedSettings;
}

/**
 * Список всех миграций
 * При изменении схемы настроек добавлять новые миграции сюда
 */
export const MIGRATIONS: SettingsMigration[] = [
  // Миграция v1 → v2: Переход на новую мультипровайдерную архитектуру
  {
    from: '1.0.0',
    to: 2,
    migrate: migrateV1ToV2,
  },
  // Миграция v2 → v2.1: Переход на группы провайдеров
  {
    from: 2,
    to: 2.1,
    migrate: migrateV2ToV21,
  },
];

/**
 * Применение миграций к настройкам
 */
export function migrateSettings(settings: any): PluginSettings {
  // Если настроек нет или нет версии - возвращаем дефолтные
  if (!settings || !settings.version) {
    console.log('[Migration] No settings found, returning defaults');
    return { ...DEFAULT_SETTINGS };
  }

  let current = settings;
  const startVersion = current.version;

  // Если версия всё ещё старая (например "1.0.0" вместо 2), применяем миграцию
  if (typeof current.version === 'string' && current.version === '1.0.0') {
    console.log('[Migration] Detected old version format, forcing v1 → v2 migration');
    current = migrateV1ToV2(current);
  }

  // Применяем миграции последовательно
  for (const migration of MIGRATIONS) {
    if (current.version === migration.from) {
      console.log(`[Migration] Applying migration ${migration.from} → ${migration.to}`);
      current = migration.migrate(current);
    }
  }

  // Проверяем что версия изменилась
  if (current.version !== startVersion) {
    console.log(`[Migration] Settings migrated from ${startVersion} to ${current.version}`);
  }

  // Финальная проверка: если версия меньше текущей (2.1), применяем недостающие миграции
  const currentVersion = typeof current.version === 'number' ? current.version : 0;
  const targetVersion = 2.1;

  if (currentVersion < targetVersion) {
    console.log(`[Migration] Current version ${currentVersion} < ${targetVersion}, applying missing migrations`);

    // Применяем недостающие миграции
    for (const migration of MIGRATIONS) {
      const fromVersion = typeof migration.from === 'number' ? migration.from : 0;
      if (current.version === migration.from && fromVersion < targetVersion) {
        console.log(`[Migration] Applying migration ${migration.from} → ${migration.to}`);
        current = migration.migrate(current);
      }
    }
  }

  return current;
}
