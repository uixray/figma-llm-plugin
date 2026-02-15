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
   * Обработка ошибок API
   */
  protected handleApiError(response: Response, data: any): never {
    const status = response.status;
    const errorMessage = this.extractErrorMessage(data);
    const providerName = this.baseConfig.name;

    console.error(`[${providerName}] API Error:`, status, data);

    // CORS/Network errors (opaque response)
    if (response.type === 'opaque' || status === 0) {
      throw new Error(
        `CORS error: Cannot connect to ${providerName}. ` +
        `This provider requires a CORS proxy. Please configure proxy settings or use a browser extension.`
      );
    }

    // Authentication errors
    if (status === 401 || status === 403) {
      throw new Error(
        `Authentication failed: Invalid API key for ${providerName}. ` +
        `Please check your API key in Settings. ${errorMessage ? `Details: ${errorMessage}` : ''}`
      );
    }

    // Rate limit errors
    if (status === 429) {
      throw new Error(
        `Rate limit exceeded: You exceeded your current quota for ${providerName}. ` +
        `Please check your plan and billing details. ${errorMessage ? `Details: ${errorMessage}` : ''}`
      );
    }

    // Bad request
    if (status === 400) {
      throw new Error(`Bad request to ${providerName}: ${errorMessage || 'Invalid parameters'}`);
    }

    // Server errors
    if (status >= 500) {
      throw new Error(`${providerName} server error: ${errorMessage || 'API server unavailable'}`);
    }

    // Generic errors
    throw new Error(`${providerName} API error (${status}): ${errorMessage || 'Unknown error'}`);
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
