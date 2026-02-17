import { UserProviderConfig, GenerationSettings } from '../../shared/types';
import { ProviderConfig } from '../../shared/providers';

/**
 * Ответ от провайдера после генерации
 */
export interface ProviderResponse {
  text: string; // Сгенерированный текст
  tokens: {
    input: number; // Токенов на входе
    output: number; // Токенов на выходе
  };
  cost: number; // Стоимость запроса в $
}

/**
 * Базовый абстрактный класс для всех провайдеров
 * Реализует Strategy паттерн
 */
export abstract class BaseProvider {
  constructor(
    protected userConfig: UserProviderConfig,
    protected baseConfig: ProviderConfig
  ) {}

  /**
   * Главный метод генерации текста
   * Должен быть реализован в каждом конкретном провайдере
   */
  abstract generateText(prompt: string, settings: GenerationSettings): Promise<ProviderResponse>;

  /**
   * Получить заголовки для HTTP запроса
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.formatApiKey(),
    };
  }

  /**
   * Форматирование API ключа (зависит от провайдера)
   */
  protected abstract formatApiKey(): string;

  /**
   * Построение тела запроса (зависит от провайдера)
   */
  protected abstract buildRequestBody(prompt: string, settings: GenerationSettings): any;

  /**
   * Парсинг ответа от API (зависит от провайдера)
   */
  protected abstract parseResponse(data: any): ProviderResponse;

  /**
   * Получить URL для API запроса
   */
  protected getApiUrl(): string {
    // Если пользователь задал custom URL - используем его
    if (this.userConfig.customUrl) {
      return this.userConfig.customUrl;
    }

    // Если провайдер требует прокси - URL уже должен указывать на прокси
    return this.baseConfig.apiUrl;
  }

  /**
   * Рассчитать стоимость запроса
   */
  protected calculateCost(inputTokens: number, outputTokens: number): number {
    // Если пользователь задал кастомные цены - используем их
    const pricing = this.userConfig.customPricing || this.baseConfig.pricing;

    // Цены указаны за 1M токенов, поэтому делим на 1_000_000
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;

    return inputCost + outputCost;
  }

  /**
   * Оценка количества токенов в тексте
   * Простая эвристика: ~4 символа = 1 токен
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Обработка ошибок API с понятными сообщениями для пользователя
   */
  protected handleApiError(response: Response, data: any): never {
    const status = response.status;
    const errorMessage = this.extractErrorMessage(data);
    const providerName = this.baseConfig.name;
    const provider = this.baseConfig.provider;

    console.error(`[${providerName}] API Error:`, status, data);

    // CORS/Network errors (opaque response)
    if (response.type === 'opaque' || status === 0) {
      throw Object.assign(
        new Error(
          `🌐 Cannot connect to ${providerName}.\n` +
          `The request was blocked by CORS. This provider requires a proxy server.\n` +
          `Check that the proxy is running at the configured URL.`
        ),
        { retryable: true }
      );
    }

    // Authentication errors
    if (status === 401 || status === 403) {
      const hints = this.getAuthHint(provider, status, errorMessage);
      throw Object.assign(
        new Error(
          `🔑 ${providerName}: Authentication failed (${status}).\n` +
          `${hints}`
        ),
        { retryable: false }
      );
    }

    // Rate limit / quota errors
    if (status === 429) {
      throw Object.assign(
        new Error(
          `⏱️ ${providerName}: Rate limit or quota exceeded.\n` +
          `Your API key has hit the usage limit. Either wait a few minutes, ` +
          `or check your billing/plan at the provider's dashboard.\n` +
          (errorMessage ? `Details: ${errorMessage}` : '')
        ),
        { retryable: true }
      );
    }

    // Bad request — often geo-blocking or invalid params
    if (status === 400) {
      const isGeoBlock = errorMessage?.toLowerCase().includes('location is not supported')
        || errorMessage?.toLowerCase().includes('not available in your country')
        || errorMessage?.toLowerCase().includes('user location');

      if (isGeoBlock) {
        throw Object.assign(
          new Error(
            `🌍 ${providerName}: Your region is blocked by this API.\n` +
            `This provider does not serve requests from your location.\n` +
            `Solution: Use a proxy server in a supported region (US/EU).\n` +
            `In your proxy config (e.g. Nginx), add a route that forwards requests ` +
            `to the provider's API from a server in the US or Europe.`
          ),
          { retryable: false }
        );
      }

      throw Object.assign(
        new Error(
          `❌ ${providerName}: Bad request (400).\n` +
          `The API rejected the request. This usually means invalid parameters.\n` +
          (errorMessage ? `Details: ${errorMessage}` : '')
        ),
        { retryable: false }
      );
    }

    // Payment required
    if (status === 402) {
      throw Object.assign(
        new Error(
          `💳 ${providerName}: Payment required.\n` +
          `Your account has no funds or the free tier is exhausted.\n` +
          `Add credits at the provider's billing page.`
        ),
        { retryable: false }
      );
    }

    // Not found
    if (status === 404) {
      throw Object.assign(
        new Error(
          `🔍 ${providerName}: Endpoint not found (404).\n` +
          `The API URL may be incorrect, or the model "${this.baseConfig.model}" ` +
          `is not available. Check Settings → Provider Groups.`
        ),
        { retryable: false }
      );
    }

    // Server errors
    if (status >= 500) {
      throw Object.assign(
        new Error(
          `🔧 ${providerName}: Server error (${status}).\n` +
          `The API server is temporarily unavailable. Try again in a few minutes.\n` +
          (errorMessage ? `Details: ${errorMessage}` : '')
        ),
        { retryable: true }
      );
    }

    // Generic fallback
    throw Object.assign(
      new Error(
        `⚠️ ${providerName}: Error ${status}.\n` +
        (errorMessage ? `Details: ${errorMessage}` : 'Unknown error occurred.')
      ),
      { retryable: false }
    );
  }

  /**
   * Подсказки по аутентификации для конкретных провайдеров
   */
  private getAuthHint(provider: string, status: number, errorMessage: string): string {
    const common = `Go to Settings → Provider Groups → Edit, and check the API key.\n`;

    switch (provider) {
      case 'openai':
        return (
          common +
          `Get your key at: platform.openai.com/api-keys\n` +
          `Make sure you have billing enabled (free trial may have expired).`
        );
      case 'claude':
        return (
          common +
          `Get your key at: console.anthropic.com/settings/keys\n` +
          `Claude requires active billing — free tier has very low limits.`
        );
      case 'gemini':
        return (
          common +
          `Get your key at: aistudio.google.com/apikey\n` +
          `Note: Gemini API is NOT available in all regions (Russia, China, etc).`
        );
      case 'groq':
        return (
          common +
          `Get your key at: console.groq.com/keys\n` +
          `Groq has a generous free tier — make sure the key is valid.`
        );
      case 'mistral':
        return (
          common +
          `Get your key at: console.mistral.ai/api-keys\n` +
          `Check that your Mistral account is active.`
        );
      case 'cohere':
        return (
          common +
          `Get your key at: dashboard.cohere.com/api-keys\n` +
          `Cohere offers a free trial tier.`
        );
      case 'yandex':
        return (
          common +
          `Use an API key from: console.yandex.cloud → Service accounts → Keys\n` +
          `Also check that Folder ID is correct.`
        );
      default:
        return common + (errorMessage ? `Details: ${errorMessage}` : '');
    }
  }

  /**
   * Извлечь сообщение об ошибке из ответа API
   */
  protected extractErrorMessage(data: any): string {
    // Разные провайдеры используют разные форматы ошибок
    if (typeof data === 'string') {
      return data;
    }

    return (
      data?.error?.message ||
      data?.error ||
      data?.message ||
      data?.detail ||
      JSON.stringify(data)
    );
  }

  /**
   * Получить название модели
   */
  getModelName(): string {
    return this.baseConfig.model;
  }

  /**
   * Получить лимиты провайдера
   */
  getLimits() {
    return this.baseConfig.limits;
  }

  /**
   * Проверить, требует ли провайдер прокси
   */
  requiresProxy(): boolean {
    return this.baseConfig.requiresProxy;
  }
}
