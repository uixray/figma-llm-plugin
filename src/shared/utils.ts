/**
 * Генерация уникального ID для сообщений
 */
export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce функция
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait) as any;
  };
}

/**
 * Оценка количества токенов в тексте
 * Примерно: 1 токен ≈ 4 символа
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Форматирование стоимости
 */
export function formatCost(cost: number, currency: string = '₽'): string {
  return `${currency}${cost.toFixed(4)}`;
}

/**
 * Форматирование времени (ms → секунды)
 */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Валидация URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Валидация не пустой строки
 */
export function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Sleep функция для async/await
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
