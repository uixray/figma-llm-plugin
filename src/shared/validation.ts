import {
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_MAX_TOKENS,
  MAX_MAX_TOKENS,
} from './constants';
import { GenerationSettings } from './types';

/**
 * Результат валидации
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Валидация промпта
// ============================================================================

/**
 * Валидация промпта
 */
export function validatePrompt(prompt: string): ValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return {
      valid: false,
      error: 'Prompt cannot be empty',
    };
  }

  if (prompt.length > 10000) {
    return {
      valid: false,
      error: 'Prompt is too long (max 10000 characters)',
    };
  }

  return { valid: true };
}

// ============================================================================
// Валидация API ключей
// ============================================================================

/**
 * Валидация API ключа в зависимости от провайдера
 */
export function validateApiKey(apiKey: string, provider: string): ValidationResult {
  // LM Studio не требует API ключа
  if (provider === 'lmstudio') {
    return { valid: true };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      valid: false,
      error: 'API key is required',
    };
  }

  // Специфичная валидация для разных провайдеров
  switch (provider) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return {
          valid: false,
          error: 'OpenAI API key must start with "sk-"',
        };
      }
      if (apiKey.length < 40) {
        return {
          valid: false,
          error: 'OpenAI API key is too short',
        };
      }
      break;

    case 'yandex':
      if (!apiKey.startsWith('AQVN')) {
        return {
          valid: false,
          error: 'Yandex API key must start with "AQVN"',
        };
      }
      break;

    case 'claude':
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          valid: false,
          error: 'Claude API key must start with "sk-ant-"',
        };
      }
      break;

    case 'gemini':
      if (apiKey.length < 30) {
        return {
          valid: false,
          error: 'Gemini API key is too short',
        };
      }
      break;

    case 'mistral':
      if (apiKey.length < 30) {
        return {
          valid: false,
          error: 'Mistral API key is too short',
        };
      }
      break;

    case 'groq':
      if (!apiKey.startsWith('gsk_')) {
        return {
          valid: false,
          error: 'Groq API key must start with "gsk_"',
        };
      }
      break;

    case 'cohere':
      if (apiKey.length < 30) {
        return {
          valid: false,
          error: 'Cohere API key is too short',
        };
      }
      break;

    default:
      // Для неизвестных провайдеров - базовая проверка
      if (apiKey.length < 10) {
        return {
          valid: false,
          error: 'API key is too short',
        };
      }
  }

  return { valid: true };
}

// ============================================================================
// Валидация URL
// ============================================================================

/**
 * Валидация URL
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return {
      valid: false,
      error: 'URL is required',
    };
  }

  try {
    const urlObj = new URL(url);

    // Проверяем что это HTTP/HTTPS
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol',
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

// ============================================================================
// Валидация настроек генерации
// ============================================================================

/**
 * Валидация настроек генерации
 */
export function validateGenerationSettings(settings: GenerationSettings): ValidationResult {
  // Валидация temperature
  if (
    settings.temperature < MIN_TEMPERATURE ||
    settings.temperature > MAX_TEMPERATURE ||
    isNaN(settings.temperature)
  ) {
    return {
      valid: false,
      error: `Temperature must be between ${MIN_TEMPERATURE} and ${MAX_TEMPERATURE}`,
    };
  }

  // Валидация maxTokens
  if (
    settings.maxTokens < MIN_MAX_TOKENS ||
    settings.maxTokens > MAX_MAX_TOKENS ||
    isNaN(settings.maxTokens) ||
    !Number.isInteger(settings.maxTokens)
  ) {
    return {
      valid: false,
      error: `Max tokens must be an integer between ${MIN_MAX_TOKENS} and ${MAX_MAX_TOKENS}`,
    };
  }

  // Валидация systemPrompt (опционально)
  if (settings.systemPrompt && settings.systemPrompt.length > 5000) {
    return {
      valid: false,
      error: 'System prompt is too long (max 5000 characters)',
    };
  }

  return { valid: true };
}

// ============================================================================
// Валидация имени конфигурации провайдера
// ============================================================================

/**
 * Валидация имени конфигурации провайдера
 */
export function validateConfigName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Configuration name cannot be empty',
    };
  }

  if (name.length > 100) {
    return {
      valid: false,
      error: 'Configuration name is too long (max 100 characters)',
    };
  }

  // Проверка на недопустимые символы
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(name)) {
    return {
      valid: false,
      error: 'Configuration name contains invalid characters',
    };
  }

  return { valid: true };
}

// ============================================================================
// Валидация кастомных цен
// ============================================================================

/**
 * Валидация кастомных цен токенов
 */
export function validatePricing(inputPrice: number, outputPrice: number): ValidationResult {
  if (isNaN(inputPrice) || inputPrice < 0) {
    return {
      valid: false,
      error: 'Input price must be a non-negative number',
    };
  }

  if (isNaN(outputPrice) || outputPrice < 0) {
    return {
      valid: false,
      error: 'Output price must be a non-negative number',
    };
  }

  // Проверка на разумность цен (не больше $1000 за 1M токенов)
  if (inputPrice > 1000 || outputPrice > 1000) {
    return {
      valid: false,
      error: 'Price seems unreasonably high. Please check your values.',
    };
  }

  return { valid: true };
}

// ============================================================================
// Валидация имени промпта
// ============================================================================

/**
 * Валидация имени сохранённого промпта
 */
export function validatePromptName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Prompt name cannot be empty',
    };
  }

  if (name.length > 200) {
    return {
      valid: false,
      error: 'Prompt name is too long (max 200 characters)',
    };
  }

  return { valid: true };
}

// ============================================================================
// Валидация имени пресета переименования
// ============================================================================

/**
 * Валидация имени пресета переименования
 */
export function validatePresetName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Preset name cannot be empty',
    };
  }

  if (name.length > 100) {
    return {
      valid: false,
      error: 'Preset name is too long (max 100 characters)',
    };
  }

  return { valid: true };
}
