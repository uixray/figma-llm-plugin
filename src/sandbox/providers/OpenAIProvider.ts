import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для OpenAI API (GPT-4o, GPT-4o Mini)
 * Также работает с OpenAI-compatible API
 */
export class OpenAIProvider extends BaseProvider {
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
      stream: false, // Figma не поддерживает streaming
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error('No content in response');
    }

    const usage = data.usage;
    const inputTokens = usage?.prompt_tokens || this.estimateTokens(prompt);
    const outputTokens = usage?.completion_tokens || this.estimateTokens(message);

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
    const url = `${this.getApiUrl()}/chat/completions`;

    console.log(`[OpenAIProvider] Making request to: ${url}`);
    console.log(`[OpenAIProvider] Model: ${this.baseConfig.model}`);

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
   * Vision support — GPT-4o and GPT-4o Mini support image input
   */
  supportsVision(): boolean {
    const model = this.baseConfig.model.toLowerCase();
    return model.includes('gpt-4o') || model.includes('gpt-4-turbo');
  }

  async generateTextWithImage(
    prompt: string,
    imageBase64: string,
    settings: GenerationSettings,
  ): Promise<ProviderResponse> {
    const url = `${this.getApiUrl()}/chat/completions`;

    const body = {
      model: this.baseConfig.model,
      messages: [
        {
          role: 'system',
          content: settings.systemPrompt || 'You are a helpful assistant analyzing designs.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'auto',
              },
            },
          ],
        },
      ],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
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
}
