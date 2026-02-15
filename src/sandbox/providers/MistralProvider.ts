import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для Mistral AI API
 * OpenAI-compatible формат
 */
export class MistralProvider extends BaseProvider {
  protected formatApiKey(): string {
    return `Bearer ${this.userConfig.apiKey}`;
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    return {
      model: this.baseConfig.model,
      messages: [
        {
          role: 'system',
          content: settings.systemPrompt || 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    const message = data.choices?.[0]?.message?.content;
    if (!message) throw new Error('No content in response');

    const usage = data.usage;
    const inputTokens = usage?.prompt_tokens || this.estimateTokens(prompt);
    const outputTokens = usage?.completion_tokens || this.estimateTokens(message);

    return {
      text: message.trim(),
      tokens: { input: inputTokens, output: outputTokens },
      cost: this.calculateCost(inputTokens, outputTokens),
    };
  }

  async generateText(prompt: string, settings: GenerationSettings): Promise<ProviderResponse> {
    const url = `${this.getApiUrl()}/chat/completions`;

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
