/**
 * LRU Response Cache for API responses.
 *
 * Caches API responses in memory (session-only, not persistent) to avoid
 * duplicate requests with the same prompt + model + settings combination.
 *
 * V2.2: Added as part of the performance optimization phase.
 */

/**
 * Cache entry stored in the LRU map
 */
interface CacheEntry {
  /** Generated text result */
  text: string;
  /** Estimated token count */
  tokens: number;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Parameters used to generate the cache key
 */
export interface CacheKeyParams {
  providerId: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Default maximum number of entries in the cache
 */
const DEFAULT_MAX_SIZE = 50;

/**
 * Default TTL for cache entries (30 minutes in ms)
 */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * LRU (Least Recently Used) response cache.
 *
 * Uses a Map to maintain insertion/access order.
 * When the cache is full, the oldest entry is evicted.
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE, ttlMs: number = DEFAULT_TTL_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a unique cache key from request parameters.
   * Uses a simple hash of the concatenated parameters.
   */
  static generateKey(params: CacheKeyParams): string {
    const raw = [
      params.providerId,
      params.prompt,
      params.systemPrompt || '',
      String(params.temperature),
      String(params.maxTokens),
    ].join('|');

    return ResponseCache.simpleHash(raw);
  }

  /**
   * Simple string hash function (DJB2 variant).
   * Not cryptographically secure, but fast and sufficient for cache keys.
   */
  private static simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(36);
  }

  /**
   * Look up a cached response.
   * Returns the cached text if found and not expired, or null.
   * Moves the entry to the "most recently used" position.
   */
  get(key: string): { text: string; tokens: number } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return { text: entry.text, tokens: entry.tokens };
  }

  /**
   * Store a response in the cache.
   * Evicts the least recently used entry if the cache is full.
   */
  set(key: string, text: string, tokens: number): void {
    // If key already exists, delete it first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      text,
      tokens,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists in the cache (without updating LRU position).
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific entry from the cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        purged++;
      }
    }

    return purged;
  }
}
