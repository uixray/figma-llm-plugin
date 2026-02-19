import { ProviderType, GenerationSettings, LMStudioConfig, YandexConfig, OpenAICompatibleConfig } from '../shared/types';
import { StorageManager } from './storage-manager';
import { estimateTokens } from '../shared/utils';
import { SimpleAbortSignal } from '../shared/abort-helper';
import { PROVIDER_CONFIGS } from '../shared/providers';
import { getAllProviderConfigs } from '../shared/provider-converter';

/**
 * Запрос на генерацию текста (V2)
 */
export interface GenerationRequest {
  providerId: string; // V2: ID из UserProviderConfig
  prompt: string;
  systemPrompt?: string;
  /** Дополнительные messages для few-shot (user/assistant пары) */
  fewShotMessages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  settings: GenerationSettings;
  signal: SimpleAbortSignal;
  onChunk: (chunk: string, estimatedTokens: number) => void;
}

/**
 * Клиент для работы с LLM API
 */
export class ApiClient {
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Генерация текста (V2 - использует providerId)
   */
  async generateText(request: GenerationRequest): Promise<void> {
    console.log('[ApiClient] generateText called for providerId:', request.providerId);

    const settings = await this.storageManager.loadSettings();
    console.log('[ApiClient] Settings loaded');

    // V2.1: Объединяем Legacy провайдеры и Provider Groups
    const legacyConfigs = settings.providerConfigs || [];
    const groups = settings.providerGroups || [];
    const allConfigs = getAllProviderConfigs(legacyConfigs, groups);
    console.log('[ApiClient] Total available configs (Legacy + Groups):', allConfigs.length);

    // Ищем конфигурацию по ID
    const userConfig = allConfigs.find(c => c.id === request.providerId);
    console.log('[ApiClient] User config:', JSON.stringify(userConfig, null, 2));

    if (!userConfig || !userConfig.enabled) {
      console.error('[ApiClient] Provider not configured or disabled');
      throw new Error(`Provider ${request.providerId} is not configured or disabled`);
    }

    // V2: Получаем базовую конфигурацию провайдера
    const baseConfigId = userConfig.baseConfigId;
    console.log('[ApiClient] Using base config:', baseConfigId);

    // Находим конфиг провайдера в PROVIDER_CONFIGS
    let providerConfig = PROVIDER_CONFIGS.find(p => p.id === baseConfigId);

    // Handle custom "Other" provider (not in PROVIDER_CONFIGS)
    if (!providerConfig && baseConfigId === 'other-custom') {
      providerConfig = {
        id: 'other-custom',
        name: userConfig.modelName || 'Custom Model',
        provider: 'other',
        description: 'User-defined custom provider',
        model: userConfig.modelName || 'custom-model',
        apiUrl: userConfig.customUrl || '',
        requiresProxy: false,
        pricing: { input: 0, output: 0 },
      };
    }

    if (!providerConfig) {
      console.error('[ApiClient] Provider config not found:', baseConfigId);
      throw new Error(`Provider config not found: ${baseConfigId}`);
    }

    console.log('[ApiClient] Provider config found:', providerConfig.name);

    // V2: Используем старую логику для совместимости (TODO: переписать на Provider классы)
    // Определяем тип провайдера по provider field
    if (providerConfig.provider === 'lmstudio') {
      // LM Studio ТРЕБУЕТ customUrl (адрес локального сервера)
      if (!userConfig.customUrl) {
        throw new Error(
          '🖥️ LM Studio requires a server URL.\n' +
          'Go to Settings → edit your LM Studio group → enter your local server address.\n' +
          'Default: http://127.0.0.1:1234\n' +
          'Make sure LM Studio is running and the server is started.'
        );
      }

      console.log('[ApiClient] LM Studio URL:', userConfig.customUrl);

      // Append /v1 if not already present (LM Studio API is always at /v1)
      const lmBaseUrl = (() => {
        const base = (userConfig.customUrl || '').replace(/\/+$/, '');
        return base.endsWith('/v1') ? base : `${base}/v1`;
      })();

      const legacyConfig: LMStudioConfig = {
        enabled: userConfig.enabled,
        apiKey: userConfig.apiKey || 'not-required', // LM Studio не требует API ключ
        baseUrl: lmBaseUrl,
      };
      return this.generateWithLMStudio(request, legacyConfig);
    } else if (providerConfig.provider === 'yandex') {
      // Для Yandex проверяем наличие folderId
      if (!userConfig.folderId || userConfig.folderId.includes('YOUR_FOLDER_ID')) {
        throw new Error(
          'Yandex provider requires Folder ID. Please edit the provider in Settings and specify your Yandex Cloud Folder ID (found at cloud.yandex.ru/console)'
        );
      }

      // Строим modelUri из folderId и model
      // Формат: gpt://<folderId>/<model>
      const modelUri = `gpt://${userConfig.folderId}/${providerConfig.model}`;
      console.log('[ApiClient] Yandex modelUri:', modelUri);

      const legacyConfig: YandexConfig = {
        enabled: userConfig.enabled,
        apiKey: userConfig.apiKey,
        folderId: userConfig.folderId,
        model: modelUri,
      };
      return this.generateWithYandex(request, legacyConfig);
    } else if (['openai', 'claude', 'gemini', 'mistral', 'groq', 'cohere'].includes(providerConfig.provider)) {
      // Resolve API URL: user custom URL > global proxy override > default provider URL
      let resolvedApiUrl = userConfig.customUrl || providerConfig.apiUrl;

      // Apply global proxy setting if available
      if (!userConfig.customUrl && settings.globalProxyUrl) {
        if (settings.globalProxyUrl === 'none') {
          // Direct connection — strip proxy prefix, use provider's native API
          // Only if the default URL is a proxy URL
          resolvedApiUrl = providerConfig.apiUrl;
        } else {
          // Custom proxy — replace proxy.uixray.tech with user's proxy
          resolvedApiUrl = providerConfig.apiUrl.replace(
            'https://proxy.uixray.tech',
            settings.globalProxyUrl.replace(/\/$/, '')
          );
        }
      }

      const legacyConfig: OpenAICompatibleConfig = {
        enabled: userConfig.enabled,
        apiKey: userConfig.apiKey,
        apiUrl: resolvedApiUrl,
        model: providerConfig.model,
      };
      return this.generateWithOpenAI(request, legacyConfig);
    } else if (providerConfig.provider === 'other' || baseConfigId === 'other-custom') {
      // Custom "Other" provider — uses OpenAI-compatible API
      const customApiUrl = userConfig.customUrl;
      const customModel = userConfig.modelName || 'custom-model';

      if (!customApiUrl) {
        throw new Error(
          'Custom provider requires API Base URL. Please edit the provider group in Settings and specify the API endpoint.'
        );
      }

      console.log('[ApiClient] Custom provider:', customApiUrl, 'model:', customModel);

      const legacyConfig: OpenAICompatibleConfig = {
        enabled: userConfig.enabled,
        apiKey: userConfig.apiKey,
        apiUrl: customApiUrl,
        model: customModel,
      };
      return this.generateWithOpenAI(request, legacyConfig);
    }

    console.error('[ApiClient] Unknown provider type:', providerConfig.provider);
    throw new Error(`Unknown provider type: ${providerConfig.provider}`);
  }

  /**
   * Генерация через LM Studio
   */
  private async generateWithLMStudio(
    request: GenerationRequest,
    config: LMStudioConfig
  ): Promise<void> {
    console.log('[ApiClient] ===== generateWithLMStudio START =====');
    console.log('[ApiClient] config:', JSON.stringify(config, null, 2));
    console.log('[ApiClient] request.settings:', JSON.stringify(request.settings, null, 2));

    const url = config.useProxy && config.proxyUrl
      ? `${config.proxyUrl}/v1/chat/completions`
      : `${config.baseUrl}/chat/completions`;

    console.log('[ApiClient] Computed URL:', url);

    // ВАЖНО: Figma's fetch НЕ поддерживает streaming (response.body undefined)
    // Всегда отправляем stream: false
    // Формируем messages с поддержкой few-shot
    const lmsMessages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      lmsMessages.push({ role: 'system', content: request.systemPrompt });
    }
    if (request.fewShotMessages) {
      for (const msg of request.fewShotMessages) {
        lmsMessages.push({ role: msg.role, content: msg.text });
      }
    }
    lmsMessages.push({ role: 'user', content: request.prompt });

    const body = {
      model: config.model,
      messages: lmsMessages,
      temperature: request.settings.temperature,
      max_tokens: request.settings.maxTokens,
      stream: false, // Принудительно отключаем streaming
    };

    // Проверяем abort перед запросом
    request.signal.throwIfAborted();

    console.log('[ApiClient] LM Studio request URL:', url);
    console.log('[ApiClient] LM Studio request body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[ApiClient] LM Studio response status:', response.status);
    console.log('[ApiClient] LM Studio response ok:', response.ok);
    console.log('[ApiClient] LM Studio response body exists:', !!response.body);

    // Проверяем abort после запроса
    request.signal.throwIfAborted();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ApiClient] LM Studio error response:', errorText);
      throw new Error(`LM Studio API error: ${response.status} ${response.statusText}: ${errorText}`);
    }

    // ВАЖНО: Figma's fetch НЕ поддерживает response.body (ReadableStream)
    // Всегда используем non-streaming режим независимо от настроек
    console.warn('[ApiClient] Figma fetch does not support streaming. Using non-streaming mode.');
    await this.handleNonStreamingResponse(response, request.onChunk);
  }

  /**
   * Генерация через Yandex Cloud
   */
  private async generateWithYandex(
    request: GenerationRequest,
    config: YandexConfig
  ): Promise<void> {
    // Используем прокси для обхода CORS в Figma плагинах
    const url = 'https://proxy.uixray.tech/api/yandex';

    // ВАЖНО: Figma's fetch НЕ поддерживает streaming (response.body undefined)
    // config.model содержит полный modelUri: gpt://<folderId>/<model>
    // Пользователь указывает его в customUrl при настройке провайдера
    // Формируем массив messages
    const messages: Array<{ role: string; text: string }> = [];

    // 1. System prompt
    if (request.systemPrompt) {
      messages.push({ role: 'system', text: request.systemPrompt });
    }

    // 2. Few-shot examples (user → assistant пары для обучения формату)
    if (request.fewShotMessages && request.fewShotMessages.length > 0) {
      for (const msg of request.fewShotMessages) {
        messages.push({ role: msg.role, text: msg.text });
      }
    }

    // 3. Финальный user prompt
    messages.push({ role: 'user', text: request.prompt });

    const body = {
      modelUri: config.model, // Полный URI, например gpt://b1g.../yandexgpt-lite/latest
      completionOptions: {
        stream: false, // Принудительно отключаем streaming
        temperature: request.settings.temperature,
        maxTokens: String(request.settings.maxTokens),
        // Отключаем режим рассуждений чтобы модель не "думала вслух"
        reasoningOptions: {
          mode: 'DISABLED',
        },
      },
      messages,
    };

    console.log('[ApiClient] Yandex request URL:', url);
    console.log('[ApiClient] Yandex request body:', JSON.stringify(body, null, 2));

    // Проверяем abort перед запросом
    request.signal.throwIfAborted();

    console.log('[ApiClient] Sending request to Yandex...');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      console.log('[ApiClient] Yandex response status:', response.status);

      // Проверяем abort после запроса
      request.signal.throwIfAborted();

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ApiClient] Yandex error response:', errorText);
        throw new Error(`Yandex API error: ${response.status} ${errorText}`);
      }

      // ВАЖНО: Figma's fetch НЕ поддерживает response.body (ReadableStream)
      // Всегда используем non-streaming режим независимо от настроек
      console.warn('[ApiClient] Figma fetch does not support streaming. Using non-streaming mode.');
      await this.handleYandexNonStreamingResponse(response, request.onChunk);
    } catch (error) {
      console.error('[ApiClient] Yandex request failed:', error);
      throw error;
    }
  }

  /**
   * Обработка не-streaming ответа от Yandex Cloud
   * Формат ответа отличается от OpenAI
   * NOTE: Figma plugin sandbox fetch() may not expose response.headers.
   */
  private async handleYandexNonStreamingResponse(
    response: Response,
    onChunk: (chunk: string, tokens: number) => void
  ): Promise<void> {
    if (response.headers && typeof response.headers.get === 'function') {
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[ApiClient] Yandex unexpected Content-Type:', contentType);
        console.error('[ApiClient] Response text (first 200 chars):', text.substring(0, 200));
        throw new Error(`Expected JSON response but received ${contentType}. Check Yandex API key and folder ID.`);
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e: any) {
      console.error('[ApiClient] Yandex JSON parse error:', e);
      throw new Error(`Failed to parse Yandex JSON response: ${e.message}`);
    }

    console.log('[ApiClient] Yandex response data:', JSON.stringify(data, null, 2));

    // Yandex формат: { result: { alternatives: [{ message: { text: "..." } }] } }
    const content = data.result?.alternatives?.[0]?.message?.text;

    if (!content) {
      console.error('[ApiClient] Invalid Yandex response format:', data);
      throw new Error('Empty response from Yandex API');
    }

    const estimatedTokens = estimateTokens(content);
    onChunk(content, estimatedTokens);
  }

  /**
   * Генерация через OpenAI-compatible API
   */
  private async generateWithOpenAI(
    request: GenerationRequest,
    config: OpenAICompatibleConfig
  ): Promise<void> {
    const url = `${config.baseUrl}/chat/completions`;

    // Формируем messages с поддержкой few-shot
    const oaiMessages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      oaiMessages.push({ role: 'system', content: request.systemPrompt });
    }
    if (request.fewShotMessages) {
      for (const msg of request.fewShotMessages) {
        oaiMessages.push({ role: msg.role, content: msg.text });
      }
    }
    oaiMessages.push({ role: 'user', content: request.prompt });

    // ВАЖНО: Figma's fetch НЕ поддерживает streaming (response.body undefined)
    const body = {
      model: config.model,
      messages: oaiMessages,
      temperature: request.settings.temperature,
      max_tokens: request.settings.maxTokens,
      stream: false, // Принудительно отключаем streaming
    };

    // Проверяем abort перед запросом
    request.signal.throwIfAborted();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        ...(config.organization ? { 'OpenAI-Organization': config.organization } : {}),
      },
      body: JSON.stringify(body),
    });

    // Проверяем abort после запроса
    request.signal.throwIfAborted();

    if (!response.ok) {
      const contentType = response.headers.get('Content-Type') || '';
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;

      try {
        const errorText = await response.text();
        console.error('[ApiClient] OpenAI error response:', errorText);

        // Проверяем, является ли ответ JSON
        if (contentType.includes('application/json')) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage += `: ${errorJson.error?.message || errorText}`;
          } catch {
            errorMessage += `: ${errorText}`;
          }
        } else {
          // HTML или другой формат - показываем краткое сообщение
          errorMessage += ' (received non-JSON response - check API URL and key)';
        }
      } catch {
        // Игнорируем ошибку чтения body
      }

      throw new Error(errorMessage);
    }

    // ВАЖНО: Figma's fetch НЕ поддерживает response.body (ReadableStream)
    // Всегда используем non-streaming режим независимо от настроек
    console.warn('[ApiClient] Figma fetch does not support streaming. Using non-streaming mode.');
    await this.handleNonStreamingResponse(response, request.onChunk);
  }

  /**
   * Обработка streaming ответа
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk: (chunk: string, tokens: number) => void
  ): Promise<void> {
    console.log('[ApiClient] handleStreamingResponse called');
    console.log('[ApiClient] response.body:', response.body);
    console.log('[ApiClient] response.bodyUsed:', response.bodyUsed);

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('[ApiClient] Response body is null or undefined');
      throw new Error('Response body is not readable');
    }

    console.log('[ApiClient] Reader created successfully');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices?.[0]?.delta?.content;

              if (chunk) {
                const estimatedTokens = estimateTokens(chunk);
                onChunk(chunk, estimatedTokens);
              }
            } catch (e) {
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Обработка не-streaming ответа
   * NOTE: Figma plugin sandbox fetch() returns a stripped Response — response.headers
   * and response.body may be undefined. Skip Content-Type check and go straight to json().
   */
  private async handleNonStreamingResponse(
    response: Response,
    onChunk: (chunk: string, tokens: number) => void
  ): Promise<void> {
    // Try Content-Type check only when headers are available (not in Figma sandbox)
    if (response.headers && typeof response.headers.get === 'function') {
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[ApiClient] Unexpected Content-Type:', contentType);
        console.error('[ApiClient] Response text (first 200 chars):', text.substring(0, 200));
        throw new Error(`Expected JSON response but received ${contentType}. Check API URL and key. Response starts with: ${text.substring(0, 100)}`);
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e: any) {
      console.error('[ApiClient] JSON parse error:', e);
      throw new Error(`Failed to parse JSON response: ${e.message}. Check that the provider URL is correct and returns JSON.`);
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[ApiClient] Empty content in response:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from API');
    }

    const estimatedTokens = estimateTokens(content);
    onChunk(content, estimatedTokens);
  }
}
