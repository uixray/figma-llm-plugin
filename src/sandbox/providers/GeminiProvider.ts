import { BaseProvider, ProviderResponse } from './BaseProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для Google Gemini API
 * Поддерживает бесплатный тир (15 req/min)
 */
export class GeminiProvider extends BaseProvider {
  protected formatApiKey(): string {
    // Gemini использует API key как query параметр, не в заголовках
    return '';
  }

  protected getHeaders(): Record<string, string> {
    // Gemini не требует Authorization заголовка
    return {
      'Content-Type': 'application/json',
    };
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    return {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
      },
      systemInstruction: settings.systemPrompt
        ? {
            parts: [{ text: settings.systemPrompt }],
          }
        : undefined,
    };
  }

  protected parseResponse(data: any): ProviderResponse {
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error('No candidates in response');
    }

    const message = candidate.content?.parts?.[0]?.text;

    if (!message) {
      throw new Error('No text in response');
    }

    // Gemini возвращает usage metadata
    const usage = data.usageMetadata;
    const inputTokens = usage?.promptTokenCount || this.estimateTokens(prompt);
    const outputTokens = usage?.candidatesTokenCount || this.estimateTokens(message);

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
    // Gemini использует API key в URL как query параметр
    const url = `${this.getApiUrl()}/models/${this.baseConfig.model}:generateContent?key=${this.userConfig.apiKey}`;

    console.log(`[GeminiProvider] Making request to: ${url.replace(this.userConfig.apiKey, '***')}`);
    console.log(`[GeminiProvider] Model: ${this.baseConfig.model}`);

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
