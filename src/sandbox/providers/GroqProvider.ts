import { OpenAIProvider } from './OpenAIProvider';

/**
 * Провайдер для Groq API
 * Использует OpenAI-compatible формат
 * Особенность: Сверхбыстрый inference (800+ tokens/sec)
 */
export class GroqProvider extends OpenAIProvider {
  // Groq использует тот же формат что и OpenAI
  // Просто наследуем всю логику
}
