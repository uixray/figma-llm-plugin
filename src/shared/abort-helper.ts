/**
 * Простой AbortSignal для Figma sandbox (где нет AbortController)
 */
export class SimpleAbortSignal {
  private _aborted = false;
  private _onabort: (() => void) | null = null;

  get aborted(): boolean {
    return this._aborted;
  }

  set onabort(handler: (() => void) | null) {
    this._onabort = handler;
  }

  abort(): void {
    if (this._aborted) return;
    this._aborted = true;
    if (this._onabort) {
      this._onabort();
    }
  }

  throwIfAborted(): void {
    if (this._aborted) {
      throw new Error('The operation was aborted');
    }
  }
}

/**
 * Создание AbortSignal с таймаутом
 */
export function createTimeoutSignal(timeoutMs: number): SimpleAbortSignal {
  const signal = new SimpleAbortSignal();
  setTimeout(() => signal.abort(), timeoutMs);
  return signal;
}
