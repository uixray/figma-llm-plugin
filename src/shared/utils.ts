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

// ============================================================================
// Prompt Variables
// ============================================================================

/**
 * Context data available for prompt variable substitution.
 * Collected from Figma selection in sandbox, sent to UI for preview.
 */
export interface PromptVariableContext {
  layer_name: string;
  layer_type: string;
  layer_text: string;
  parent_name: string;
  frame_name: string;
  page_name: string;
  siblings: string;
  selection_count: string;
}

/**
 * All available prompt variables with descriptions
 */
export const PROMPT_VARIABLES: Array<{ key: string; description: string }> = [
  { key: 'layer_name', description: 'Name of the selected layer' },
  { key: 'layer_type', description: 'Type of the selected layer (TEXT, FRAME, etc.)' },
  { key: 'layer_text', description: 'Text content of the selected layer' },
  { key: 'parent_name', description: 'Name of the parent node' },
  { key: 'frame_name', description: 'Name of the nearest containing frame' },
  { key: 'page_name', description: 'Name of the current Figma page' },
  { key: 'siblings', description: 'Names of sibling layers (comma-separated)' },
  { key: 'selection_count', description: 'Number of selected layers' },
];

/**
 * Resolve prompt variables by replacing {variable_name} placeholders
 * with actual values from the context.
 */
export function resolvePromptVariables(
  template: string,
  context: PromptVariableContext,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in context) {
      return context[key as keyof PromptVariableContext] || '';
    }
    // Leave unrecognized variables as-is
    return match;
  });
}

/**
 * Check if a prompt contains any variables ({...} patterns)
 */
export function promptHasVariables(prompt: string): boolean {
  return /\{(\w+)\}/.test(prompt);
}
