import { OpenAIProvider } from './OpenAIProvider';
import { GenerationSettings } from '../../shared/types';

/**
 * Провайдер для LM Studio (локальный сервер)
 * Использует OpenAI-compatible API
 * Особенности: бесплатный, приватный, работает офлайн
 */
export class LMStudioProvider extends OpenAIProvider {
  protected formatApiKey(): string {
    // LM Studio не требует API ключа
    return '';
  }

  protected getHeaders(): Record<string, string> {
    // Убираем Authorization заголовок для локального сервера
    return {
      'Content-Type': 'application/json',
    };
  }

  protected getApiUrl(): string {
    // Для LM Studio customUrl обязателен (локальный адрес сервера)
    if (!this.userConfig.customUrl) {
      throw new Error('LM Studio requires Custom URL. Please edit the provider in Settings and specify your local server address (e.g., http://127.0.0.1:1234).');
    }
    // LM Studio API is always at /v1 — append it if not already present
    const base = this.userConfig.customUrl.replace(/\/+$/, '');
    return base.endsWith('/v1') ? base : `${base}/v1`;
  }

  protected buildRequestBody(prompt: string, settings: GenerationSettings): any {
    // Используем пользовательское название модели или базовое
    const model = this.userConfig.modelName || this.baseConfig.model;

    return {
      model,
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
      stream: false,
    };
  }
}
