import {
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_PROXY_URL,
  YANDEX_PROXY_URL,
  PLUGIN_VERSION,
  PLUGIN_BUILD,
  PLUGIN_WIDTH,
  PLUGIN_HEIGHT,
  SETTINGS_LOAD_TIMEOUT,
  GENERATION_TIMEOUT,
  CONNECTION_TEST_TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY,
  RETRY_BACKOFF_MULTIPLIER,
  CHARS_PER_TOKEN,
  DEFAULT_TOKEN_PRICES,
  NOTIFICATION_AUTO_HIDE_DELAY,
  DEBOUNCE_DELAY,
  STORAGE_KEY_SETTINGS,
  ERROR_MESSAGES,
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_MAX_TOKENS,
  MAX_MAX_TOKENS,
  DEFAULT_RENAME_PRESETS,
} from './constants';

describe('Constants', () => {
  describe('URLs', () => {
    it('should have valid default URLs', () => {
      expect(DEFAULT_LM_STUDIO_URL).toContain('localhost');
      expect(DEFAULT_LM_STUDIO_URL).toContain('/v1');
      expect(DEFAULT_PROXY_URL).toContain('localhost');
      expect(YANDEX_PROXY_URL).toContain('https://');
    });
  });

  describe('Timeouts', () => {
    it('should have reasonable timeout values', () => {
      expect(SETTINGS_LOAD_TIMEOUT).toBeGreaterThanOrEqual(1000);
      expect(GENERATION_TIMEOUT).toBeGreaterThanOrEqual(10000);
      expect(CONNECTION_TEST_TIMEOUT).toBeGreaterThanOrEqual(3000);
    });

    it('should have generation timeout longer than settings load', () => {
      expect(GENERATION_TIMEOUT).toBeGreaterThan(SETTINGS_LOAD_TIMEOUT);
    });
  });

  describe('Retry configuration', () => {
    it('should have valid retry settings', () => {
      expect(MAX_RETRY_ATTEMPTS).toBeGreaterThanOrEqual(1);
      expect(MAX_RETRY_ATTEMPTS).toBeLessThanOrEqual(10);
      expect(INITIAL_RETRY_DELAY).toBeGreaterThan(0);
      expect(RETRY_BACKOFF_MULTIPLIER).toBeGreaterThan(1);
    });
  });

  describe('Token/Cost', () => {
    it('should have a reasonable characters per token estimate', () => {
      expect(CHARS_PER_TOKEN).toBeGreaterThan(0);
      expect(CHARS_PER_TOKEN).toBeLessThanOrEqual(10);
    });

    it('should have LM Studio as free', () => {
      expect(DEFAULT_TOKEN_PRICES.lmstudio).toBe(0);
    });

    it('should have positive prices for paid providers', () => {
      expect(DEFAULT_TOKEN_PRICES.yandex).toBeGreaterThan(0);
      expect(DEFAULT_TOKEN_PRICES['openai-compatible']).toBeGreaterThan(0);
    });
  });

  describe('Plugin metadata', () => {
    it('should have valid version format', () => {
      expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have valid build number format (YYYYMMDD)', () => {
      expect(PLUGIN_BUILD).toMatch(/^\d{8}$/);
    });

    it('should have reasonable UI dimensions', () => {
      expect(PLUGIN_WIDTH).toBeGreaterThan(200);
      expect(PLUGIN_WIDTH).toBeLessThan(800);
      expect(PLUGIN_HEIGHT).toBeGreaterThan(200);
      expect(PLUGIN_HEIGHT).toBeLessThan(1200);
    });
  });

  describe('UI constants', () => {
    it('should have reasonable notification delay', () => {
      expect(NOTIFICATION_AUTO_HIDE_DELAY).toBeGreaterThanOrEqual(1000);
      expect(NOTIFICATION_AUTO_HIDE_DELAY).toBeLessThanOrEqual(10000);
    });

    it('should have reasonable debounce delay', () => {
      expect(DEBOUNCE_DELAY).toBeGreaterThanOrEqual(100);
      expect(DEBOUNCE_DELAY).toBeLessThanOrEqual(2000);
    });
  });

  describe('Storage keys', () => {
    it('should have non-empty storage keys', () => {
      expect(STORAGE_KEY_SETTINGS).toBeTruthy();
      expect(typeof STORAGE_KEY_SETTINGS).toBe('string');
    });
  });

  describe('Error messages', () => {
    it('should define all expected error types', () => {
      expect(ERROR_MESSAGES.NETWORK).toBeTruthy();
      expect(ERROR_MESSAGES.TIMEOUT).toBeTruthy();
      expect(ERROR_MESSAGES.AUTH).toBeTruthy();
      expect(ERROR_MESSAGES.RATE_LIMIT).toBeTruthy();
      expect(ERROR_MESSAGES.INVALID_CONFIG).toBeTruthy();
      expect(ERROR_MESSAGES.API_ERROR).toBeTruthy();
      expect(ERROR_MESSAGES.UNKNOWN).toBeTruthy();
      expect(ERROR_MESSAGES.NO_SELECTION).toBeTruthy();
      expect(ERROR_MESSAGES.EMPTY_PROMPT).toBeTruthy();
      expect(ERROR_MESSAGES.PROVIDER_DISABLED).toBeTruthy();
    });

    it('should have descriptive error messages', () => {
      for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
        expect(value.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Validation boundaries', () => {
    it('should have valid temperature range', () => {
      expect(MIN_TEMPERATURE).toBe(0);
      expect(MAX_TEMPERATURE).toBeGreaterThan(MIN_TEMPERATURE);
      expect(MAX_TEMPERATURE).toBeLessThanOrEqual(2.0);
    });

    it('should have valid max tokens range', () => {
      expect(MIN_MAX_TOKENS).toBeGreaterThan(0);
      expect(MAX_MAX_TOKENS).toBeGreaterThan(MIN_MAX_TOKENS);
    });
  });

  describe('Rename presets', () => {
    it('should have at least 3 presets', () => {
      expect(DEFAULT_RENAME_PRESETS.length).toBeGreaterThanOrEqual(3);
    });

    it('should have unique IDs', () => {
      const ids = DEFAULT_RENAME_PRESETS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have names and rules for each preset', () => {
      for (const preset of DEFAULT_RENAME_PRESETS) {
        expect(preset.name).toBeTruthy();
        expect(preset.type).toBeTruthy();
        expect(preset.rules.length).toBeGreaterThan(0);
      }
    });

    it('should include common naming conventions', () => {
      const types = DEFAULT_RENAME_PRESETS.map(p => p.type);
      expect(types).toContain('camelCase');
      expect(types).toContain('snakeCase');
      expect(types).toContain('kebabCase');
    });
  });
});
