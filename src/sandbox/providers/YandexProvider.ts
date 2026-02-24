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

  /**
   * Vision support — Gemma 3 27B IT is a multimodal model on Yandex
   */
  supportsVision(): boolean {
    const model = this.baseConfig.model.toLowerCase();
    return model.includes('gemma-3');
  }

  async generateTextWithImage(
    prompt: string,
    imageBase64: string,
    settings: GenerationSettings,
  ): Promise<ProviderResponse> {
    const url = this.getApiUrl();

    console.log(`[YandexProvider] Vision request to: ${url}`);
    console.log(`[YandexProvider] Model: ${this.baseConfig.model}`);

    const body = {
      modelUri: `gpt://${this.extractFolderId()}/${this.baseConfig.model}`,
      completionOptions: {
        stream: false,
        temperature: settings.temperature,
        maxTokens: String(settings.maxTokens),
      },
      messages: [
        {
          role: 'system',
          text: settings.systemPrompt || 'Ты полезный помощник.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.handleApiError(response, data);
    }

    return this.parseResponse(data);
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
    throw new Error('Yandex: Folder ID is missing. Open the plugin → Settings → edit your Yandex group and enter Folder ID (find it in Yandex Cloud Console → Overview).');
  }
}
