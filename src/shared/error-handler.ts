import { ERROR_MESSAGES } from './constants';

/**
 * Типы ошибок плагина
 */
export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  AUTH = 'auth',
  RATE_LIMIT = 'rate_limit',
  INVALID_CONFIG = 'invalid_config',
  API_ERROR = 'api_error',
  UNKNOWN = 'unknown',
}

/**
 * Структура ошибки плагина
 */
export interface PluginError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  details?: any;
}

/**
 * Класс для обработки ошибок
 */
export class ErrorHandler {
  /**
   * Конвертация любой ошибки в PluginError
   */
  static handle(error: any): PluginError {
    // Network errors
    if (error.name === 'AbortError') {
      return {
        type: ErrorType.TIMEOUT,
        message: ERROR_MESSAGES.TIMEOUT,
        retryable: true,
      };
    }

    if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: ERROR_MESSAGES.NETWORK,
        retryable: true,
      };
    }

    // HTTP errors
    if (error.status) {
      switch (error.status) {
        case 401:
        case 403:
          return {
            type: ErrorType.AUTH,
            message: ERROR_MESSAGES.AUTH,
            retryable: false,
          };
        case 429:
          return {
            type: ErrorType.RATE_LIMIT,
            message: ERROR_MESSAGES.RATE_LIMIT,
            retryable: true,
          };
        case 500:
        case 502:
        case 503:
          return {
            type: ErrorType.API_ERROR,
            message: ERROR_MESSAGES.API_ERROR,
            retryable: true,
          };
        default:
          return {
            type: ErrorType.API_ERROR,
            message: `API error: ${error.status} ${error.statusText || ''}`,
            retryable: false,
          };
      }
    }

    // Unknown errors
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || ERROR_MESSAGES.UNKNOWN,
      retryable: false,
      details: error,
    };
  }

  /**
   * Проверка, можно ли повторить запрос
   */
  static isRetryable(error: PluginError): boolean {
    return error.retryable;
  }
}
