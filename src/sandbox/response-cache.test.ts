import { ResponseCache, CacheKeyParams } from './response-cache';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(5); // small size for testing
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same parameters', () => {
      const params: CacheKeyParams = {
        providerId: 'openai-gpt4',
        prompt: 'Hello world',
        systemPrompt: 'You are helpful',
        temperature: 0.7,
        maxTokens: 2000,
      };
      const key1 = ResponseCache.generateKey(params);
      const key2 = ResponseCache.generateKey(params);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different prompts', () => {
      const params1: CacheKeyParams = {
        providerId: 'openai-gpt4',
        prompt: 'Hello world',
        temperature: 0.7,
        maxTokens: 2000,
      };
      const params2: CacheKeyParams = {
        ...params1,
        prompt: 'Goodbye world',
      };
      const key1 = ResponseCache.generateKey(params1);
      const key2 = ResponseCache.generateKey(params2);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different providers', () => {
      const params1: CacheKeyParams = {
        providerId: 'openai-gpt4',
        prompt: 'Hello',
        temperature: 0.7,
        maxTokens: 2000,
      };
      const params2: CacheKeyParams = {
        ...params1,
        providerId: 'claude-sonnet',
      };
      expect(ResponseCache.generateKey(params1)).not.toBe(ResponseCache.generateKey(params2));
    });

    it('should generate different keys for different temperatures', () => {
      const params1: CacheKeyParams = {
        providerId: 'openai-gpt4',
        prompt: 'Hello',
        temperature: 0.7,
        maxTokens: 2000,
      };
      const params2: CacheKeyParams = {
        ...params1,
        temperature: 1.0,
      };
      expect(ResponseCache.generateKey(params1)).not.toBe(ResponseCache.generateKey(params2));
    });

    it('should handle missing systemPrompt as empty string', () => {
      const params1: CacheKeyParams = {
        providerId: 'openai-gpt4',
        prompt: 'Hello',
        temperature: 0.7,
        maxTokens: 2000,
      };
      const params2: CacheKeyParams = {
        ...params1,
        systemPrompt: undefined,
      };
      expect(ResponseCache.generateKey(params1)).toBe(ResponseCache.generateKey(params2));
    });
  });

  describe('set and get', () => {
    it('should store and retrieve a cached response', () => {
      cache.set('key1', 'Hello response', 100);
      const result = cache.get('key1');
      expect(result).toEqual({ text: 'Hello response', tokens: 100 });
    });

    it('should return null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should update existing keys', () => {
      cache.set('key1', 'First', 50);
      cache.set('key1', 'Second', 100);
      const result = cache.get('key1');
      expect(result).toEqual({ text: 'Second', tokens: 100 });
      expect(cache.size).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      // Fill cache to capacity (max 5)
      cache.set('k1', 'v1', 10);
      cache.set('k2', 'v2', 20);
      cache.set('k3', 'v3', 30);
      cache.set('k4', 'v4', 40);
      cache.set('k5', 'v5', 50);
      expect(cache.size).toBe(5);

      // Adding one more should evict k1 (oldest)
      cache.set('k6', 'v6', 60);
      expect(cache.size).toBe(5);
      expect(cache.get('k1')).toBeNull();
      expect(cache.get('k6')).toEqual({ text: 'v6', tokens: 60 });
    });

    it('should promote accessed items (LRU behavior)', () => {
      cache.set('k1', 'v1', 10);
      cache.set('k2', 'v2', 20);
      cache.set('k3', 'v3', 30);
      cache.set('k4', 'v4', 40);
      cache.set('k5', 'v5', 50);

      // Access k1 — moves it to most recent
      cache.get('k1');

      // Add new entry — should evict k2 (now the oldest), not k1
      cache.set('k6', 'v6', 60);
      expect(cache.get('k1')).toEqual({ text: 'v1', tokens: 10 }); // still here
      expect(cache.get('k2')).toBeNull(); // evicted
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      // Create cache with very short TTL (1 ms)
      const shortCache = new ResponseCache(10, 1);
      shortCache.set('key1', 'value', 100);

      // Wait a bit so TTL expires
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      expect(shortCache.get('key1')).toBeNull();
    });

    it('should not expire entries within TTL', () => {
      // Create cache with long TTL (1 hour)
      const longCache = new ResponseCache(10, 3600000);
      longCache.set('key1', 'value', 100);
      expect(longCache.get('key1')).toEqual({ text: 'value', tokens: 100 });
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value', 100);
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      const shortCache = new ResponseCache(10, 1);
      shortCache.set('key1', 'value', 100);
      const start = Date.now();
      while (Date.now() - start < 5) {}
      expect(shortCache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove an entry', () => {
      cache.set('key1', 'value', 100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('should return false when deleting nonexistent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('k1', 'v1', 10);
      cache.set('k2', 'v2', 20);
      cache.set('k3', 'v3', 30);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('k1')).toBeNull();
    });
  });

  describe('purgeExpired', () => {
    it('should remove only expired entries', () => {
      const shortCache = new ResponseCache(10, 1);

      // Add entry that will expire
      shortCache.set('old', 'old-value', 10);

      // Wait for it to expire
      const start = Date.now();
      while (Date.now() - start < 5) {}

      // Add fresh entry
      shortCache.set('new', 'new-value', 20);

      const purged = shortCache.purgeExpired();
      expect(purged).toBe(1);
      expect(shortCache.size).toBe(1);
      expect(shortCache.get('old')).toBeNull();
      expect(shortCache.get('new')).toEqual({ text: 'new-value', tokens: 20 });
    });
  });

  describe('size', () => {
    it('should reflect current number of entries', () => {
      expect(cache.size).toBe(0);
      cache.set('k1', 'v1', 10);
      expect(cache.size).toBe(1);
      cache.set('k2', 'v2', 20);
      expect(cache.size).toBe(2);
      cache.delete('k1');
      expect(cache.size).toBe(1);
    });
  });
});
