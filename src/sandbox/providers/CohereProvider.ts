import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для Cohere API
 * Использует свой формат (не OpenAI-compatible)
 */
export class CohereProvider extends BaseProvider {
  protected formatApiKey(): string {
    return `Bearer ${this.userConfig.apiKey}`;
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    return {
      model: this.baseConfig.model,
      message: prompt,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      preamble: settings.systemPrompt || 'You are a helpful assistant.',
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    const message = data.text;
    if (!message) throw new Error('No text in response');

    // Cohere возвращает meta с информацией о токенах
    const meta = data.meta;
    const inputTokens = meta?.tokens?.input_tokens || this.estimateTokens(prompt);
    const outputTokens = meta?.tokens?.output_tokens || this.estimateTokens(message);

    return {
      text: message.trim(),
      tokens: { input: inputTokens, output: outputTokens },
      cost: this.calculateCost(inputTokens, outputTokens),
    };
  }

  async generateText(prompt: string, settings: GenerationSettings): Promise<ProviderResponse> {
    const url = `${this.getApiUrl()}/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildRequestBody(prompt, settings)),
    });

    const data = await response.json();
    if (!response.ok) this.handleApiError(response, data);

    return this.parseResponse(data);
  }
}
