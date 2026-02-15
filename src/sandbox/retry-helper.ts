import { ErrorType, ErrorHandler, PluginError } from '../shared/error-handler';
import { MAX_RETRY_ATTEMPTS, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY, RETRY_BACKOFF_MULTIPLIER } from '../shared/constants';
import { sleep } from '../shared/utils';

/**
 * Опции для retry логики
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

/**
 * Дефолтные опции retry
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: MAX_RETRY_ATTEMPTS,
  initialDelay: INITIAL_RETRY_DELAY,
  maxDelay: MAX_RETRY_DELAY,
  backoffMultiplier: RETRY_BACKOFF_MULTIPLIER,
  retryableErrors: [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.RATE_LIMIT],
};

/**
 * Обёртка для автоматического retry
 * @param fn Функция для выполнения
 * @param options Опции retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: PluginError | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = ErrorHandler.handle(error);

      // Не повторяем, если ошибка не retryable
      if (!opts.retryableErrors.includes(lastError.type)) {
        throw lastError;
      }

      // Последняя попытка - выбрасываем ошибку
      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Ждём перед следующей попыткой
      console.log(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`);
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError || new Error('Retry failed');
}
