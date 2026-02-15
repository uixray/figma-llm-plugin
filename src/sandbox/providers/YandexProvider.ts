import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для Yandex Cloud Foundation Models API
 * Работает через прокси на proxy.uixray.tech
 */
export class YandexProvider extends BaseProvider {
  protected formatApiKey(): string {
    // Yandex использует просто API ключ без префикса
    return `Api-Key ${this.userConfig.apiKey}`;
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    // Yandex использует свой формат запроса
    return {
      modelUri: `gpt://${this.extractFolderId()}/${this.baseConfig.model}`,
      completionOptions: {
        stream: false,
        temperature: settings.temperature,
        maxTokens: String(settings.maxTokens), // Yandex требует строку
      },
      messages: [
        {
          role: 'system',
          text: settings.systemPrompt || 'Ты полезный помощник.',
        },
        {
          role: 'user',
          text: prompt,
        },
      ],
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    // Yandex возвращает альтернативы
    const alternative = data.result?.alternatives?.[0];

    if (!alternative) {
      throw new Error('No alternatives in response');
    }

    const message = alternative.message?.text;

    if (!message) {
      throw new Error('No text in response');
    }

    // Yandex возвращает usage в другом месте
    const usage = data.result?.usage;
    const inputTokens = usage?.inputTextTokens || this.estimateTokens(prompt);
    const outputTokens = usage?.completionTokens || this.estimateTokens(message);

    return {
      text: message.trim(),
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      cost: this.calculateCost(inputTokens, outputTokens),
    };
  }

  async generateText(prompt: string, settings: GenerationSettings): Promise<ProviderResponse> {
    // URL уже указывает на прокси
    const url = this.getApiUrl();

    console.log(`[YandexProvider] Making request to: ${url}`);
    console.log(`[YandexProvider] Model: ${this.baseConfig.model}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildRequestBody(prompt, settings)),
    });

    const data = await response.json();

    if (!response.ok) {
      this.handleApiError(response, data);
    }

    return this.parseResponse(data);
  }

  /**
   * Извлечь folder ID из конфигурации пользователя
   * Yandex требует folder ID в modelUri
   */
  private extractFolderId(): string {
    if (this.userConfig.folderId) {
      return this.userConfig.folderId;
    }

    // Если folderId не указан, выбросить ошибку
    throw new Error('Yandex provider requires Model URI. Please edit the provider in Settings and specify Folder ID.');
  }
}
