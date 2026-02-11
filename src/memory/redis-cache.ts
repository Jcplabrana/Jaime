/**
 * Redis Cache Layer (L1) — Fast in-memory cache for Memory Engine.
 * Pattern: getOrSet(key, fallbackFn, ttl)
 * Target: cache hit rate ≥ 85%, latency < 5ms on hit.
 *
 * Part of Fase 4: Memory Engine 3-Layer.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("jarvis:redis-cache");

export interface RedisCacheConfig {
  /** Redis connection URL (default: redis://localhost:6379). */
  url?: string;
  /** Default TTL in seconds (default: 3600 = 1h). */
  defaultTtl?: number;
  /** Key prefix for namespace isolation (default: "jarvis:mem:"). */
  keyPrefix?: string;
}

const DEFAULTS: Required<RedisCacheConfig> = {
  url: "redis://localhost:6379",
  defaultTtl: 3600,
  keyPrefix: "jarvis:mem:",
};

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: number;
}

/**
 * Redis-based L1 cache with getOrSet pattern.
 * Degrades gracefully when Redis is unavailable —
 * falls through to L2 (PostgreSQL) transparently.
 */
export class RedisMemoryCache {
  private config: Required<RedisCacheConfig>;
  private connected = false;
  private client: RedisLikeClient | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
    hitRate: 0,
  };

  constructor(config?: RedisCacheConfig) {
    this.config = { ...DEFAULTS, ...config };
  }

  /**
   * Connect to Redis. Call once at startup.
   * Uses dynamic import to avoid hard dependency on ioredis.
   */
  async connect(): Promise<boolean> {
    try {
      // Dynamic import — ioredis is optional
      const { default: Redis } = await import("ioredis");
      this.client = new Redis(this.config.url, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
        lazyConnect: true,
        connectTimeout: 5000,
      }) as unknown as RedisLikeClient;
      await (this.client as { connect: () => Promise<void> }).connect();
      this.connected = true;
      log.info(`Redis L1 cache connected: ${this.config.url}`);
      return true;
    } catch (err) {
      this.connected = false;
      this.client = null;
      log.warn(
        `Redis unavailable (L1 cache disabled, falling through to L2): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  /**
   * Get a value from cache, or compute + set it.
   * Core pattern for the 3-layer memory cascade.
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number,
  ): Promise<{ value: T; source: "cache" | "fallback" }> {
    const prefixedKey = `${this.config.keyPrefix}${key}`;

    // Try cache hit
    if (this.connected && this.client) {
      try {
        const cached = await this.client.get(prefixedKey);
        if (cached !== null && cached !== undefined) {
          this.stats.hits++;
          this.updateHitRate();
          return { value: JSON.parse(cached) as T, source: "cache" };
        }
      } catch (err) {
        this.stats.errors++;
        log.warn(`Redis GET error for ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Cache miss — compute from fallback (L2/L3)
    this.stats.misses++;
    this.updateHitRate();
    const value = await fallback();

    // Set in cache for next time (fire-and-forget)
    if (this.connected && this.client) {
      const effectiveTtl = ttl ?? this.config.defaultTtl;
      try {
        await this.client.setex(prefixedKey, effectiveTtl, JSON.stringify(value));
        this.stats.sets++;
      } catch (err) {
        this.stats.errors++;
        log.warn(`Redis SET error for ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { value, source: "fallback" };
  }

  /**
   * Direct get from cache (no fallback).
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null;
    const prefixedKey = `${this.config.keyPrefix}${key}`;
    try {
      const cached = await this.client.get(prefixedKey);
      if (cached !== null && cached !== undefined) {
        this.stats.hits++;
        this.updateHitRate();
        return JSON.parse(cached) as T;
      }
    } catch {
      this.stats.errors++;
    }
    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Direct set to cache.
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.connected || !this.client) return;
    const prefixedKey = `${this.config.keyPrefix}${key}`;
    const effectiveTtl = ttl ?? this.config.defaultTtl;
    try {
      await this.client.setex(prefixedKey, effectiveTtl, JSON.stringify(value));
      this.stats.sets++;
    } catch {
      this.stats.errors++;
    }
  }

  /**
   * Delete a key from cache.
   */
  async delete(key: string): Promise<void> {
    if (!this.connected || !this.client) return;
    const prefixedKey = `${this.config.keyPrefix}${key}`;
    try {
      await this.client.del(prefixedKey);
    } catch {
      this.stats.errors++;
    }
  }

  /**
   * Delete all keys matching a pattern (agent namespace).
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (!this.connected || !this.client) return 0;
    const pattern = `${this.config.keyPrefix}${prefix}*`;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch {
      this.stats.errors++;
      return 0;
    }
  }

  /** Get cache statistics. */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /** Check if connected. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Disconnect from Redis. */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await (this.client as { quit: () => Promise<void> }).quit();
      } catch {
        // Ignore disconnect errors
      }
      this.client = null;
      this.connected = false;
      log.info("Redis L1 cache disconnected");
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Minimal interface for Redis client operations.
 * Avoids hard coupling to ioredis types.
 */
interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
