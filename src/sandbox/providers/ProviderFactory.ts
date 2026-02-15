import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { YandexProvider } from './YandexProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { GeminiProvider } from './GeminiProvider';
import { MistralProvider } from './MistralProvider';
import { GroqProvider } from './GroqProvider';
import { CohereProvider } from './CohereProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { UserProviderConfig } from '../../shared/types';
import { ProviderConfig } from '../../shared/providers';

/**
 * Фабрика для создания провайдеров
 * Реализует Factory паттерн
 */
export class ProviderFactory {
  /**
   * Создать экземпляр провайдера на основе конфигурации
   */
  static createProvider(
    userConfig: UserProviderConfig,
    baseConfig: ProviderConfig
  ): BaseProvider {
    const providerType = baseConfig.provider;

    console.log(`[ProviderFactory] Creating provider: ${providerType} (${baseConfig.name})`);

    switch (providerType) {
      case 'openai':
        return new OpenAIProvider(userConfig, baseConfig);

      case 'yandex':
        return new YandexProvider(userConfig, baseConfig);

      case 'claude':
        return new ClaudeProvider(userConfig, baseConfig);

      case 'gemini':
        return new GeminiProvider(userConfig, baseConfig);

      case 'mistral':
        return new MistralProvider(userConfig, baseConfig);

      case 'groq':
        return new GroqProvider(userConfig, baseConfig);

      case 'cohere':
        return new CohereProvider(userConfig, baseConfig);

      case 'lmstudio':
        return new LMStudioProvider(userConfig, baseConfig);

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Получить список всех доступных типов провайдеров
   */
  static getAvailableProviderTypes(): string[] {
    return ['openai', 'yandex', 'claude', 'gemini', 'mistral', 'groq', 'cohere', 'lmstudio'];
  }

  /**
   * Проверить, поддерживается ли тип провайдера
   */
  static isProviderSupported(providerType: string): boolean {
    return this.getAvailableProviderTypes().includes(providerType);
  }
}
