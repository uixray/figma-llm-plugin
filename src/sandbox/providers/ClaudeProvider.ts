import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для Anthropic Claude API
 * Требует CORS proxy (как Yandex)
 */
export class ClaudeProvider extends BaseProvider {
  protected formatApiKey(): string {
    return `Bearer ${this.userConfig.apiKey}`;
  }

  protected getHeaders(): Record<string, string> {
    // Claude требует специальный заголовок с версией API
    return {
      ...super.getHeaders(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // Если через прокси
    };
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    return {
      model: this.baseConfig.model,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      system: settings.systemPrompt || 'You are a helpful assistant.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    const message = data.content?.[0]?.text;

    if (!message) {
      throw new Error('No content in response');
    }

    // Claude возвращает usage
    const usage = data.usage;
    const inputTokens = usage?.input_tokens || this.estimateTokens(prompt);
    const outputTokens = usage?.output_tokens || this.estimateTokens(message);

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
    // Если requiresProxy = true, URL уже должен указывать на прокси
    const url = `${this.getApiUrl()}/messages`;

    console.log(`[ClaudeProvider] Making request to: ${url}`);
    console.log(`[ClaudeProvider] Model: ${this.baseConfig.model}`);
    console.log(`[ClaudeProvider] Requires proxy: ${this.requiresProxy()}`);

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
}
