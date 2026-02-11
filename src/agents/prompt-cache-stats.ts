/**
 * Prompt Cache Statistics — tracks Anthropic prompt caching metrics.
 * Monitors cache_read_input_tokens vs cache_creation_input_tokens
 * to measure the 64% cost savings from system prompt caching.
 *
 * Part of Fase 3: Token Economy.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("jarvis:prompt-cache");

export interface CacheHitMetrics {
  /** Total requests made. */
  totalRequests: number;
  /** Requests that used cached content. */
  cacheHits: number;
  /** Requests that created new cache entries. */
  cacheCreations: number;
  /** Total tokens read from cache (free / 90% discount). */
  cacheReadTokens: number;
  /** Total tokens used to create cache entries (25% premium on first call). */
  cacheCreationTokens: number;
  /** Total regular input tokens (not cached). */
  regularInputTokens: number;
  /** Estimated cost savings ($). */
  estimatedSavings: number;
  /** Cache hit rate (0-1). */
  hitRate: number;
}

// Anthropic pricing per 1M tokens (Claude 3.5 Sonnet)
const PRICE_PER_1M_INPUT = 3.0; // $3/1M
const PRICE_PER_1M_CACHE_READ = 0.3; // $0.30/1M (90% savings)
const PRICE_PER_1M_CACHE_WRITE = 3.75; // $3.75/1M (25% premium)

class PromptCacheStats {
  private metrics: CacheHitMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheCreations: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    regularInputTokens: 0,
    estimatedSavings: 0,
    hitRate: 0,
  };

  /**
   * Record usage from an API response.
   * Extracts cache-specific fields from the Anthropic response.
   */
  recordUsage(usage: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }): void {
    this.metrics.totalRequests++;

    const inputTokens = usage.input_tokens ?? 0;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;

    this.metrics.regularInputTokens += inputTokens;
    this.metrics.cacheReadTokens += cacheReadTokens;
    this.metrics.cacheCreationTokens += cacheCreationTokens;

    if (cacheReadTokens > 0) {
      this.metrics.cacheHits++;
    }
    if (cacheCreationTokens > 0) {
      this.metrics.cacheCreations++;
    }

    // Calculate savings: what we would have paid vs what we actually paid
    const withoutCacheCost =
      ((inputTokens + cacheReadTokens + cacheCreationTokens) / 1_000_000) *
      PRICE_PER_1M_INPUT;
    const withCacheCost =
      (inputTokens / 1_000_000) * PRICE_PER_1M_INPUT +
      (cacheReadTokens / 1_000_000) * PRICE_PER_1M_CACHE_READ +
      (cacheCreationTokens / 1_000_000) * PRICE_PER_1M_CACHE_WRITE;

    this.metrics.estimatedSavings += withoutCacheCost - withCacheCost;

    // Update hit rate
    this.metrics.hitRate =
      this.metrics.totalRequests > 0
        ? this.metrics.cacheHits / this.metrics.totalRequests
        : 0;

    if (cacheReadTokens > 0) {
      log.info(
        `Cache HIT: ${cacheReadTokens} tokens read from cache (saved $${(withoutCacheCost - withCacheCost).toFixed(4)})`,
      );
    }
  }

  /** Get current metrics snapshot. */
  getMetrics(): CacheHitMetrics {
    return { ...this.metrics };
  }

  /** Reset all metrics. */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheCreations: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      regularInputTokens: 0,
      estimatedSavings: 0,
      hitRate: 0,
    };
  }
}

/** Singleton instance for app-wide cache tracking. */
export const promptCacheStats = new PromptCacheStats();

/**
 * Split a system prompt into static (cacheable) and dynamic sections.
 *
 * Static prefix: identity, tooling, safety, CLI, skills, memory guidelines
 * Dynamic suffix: workspace, context files, runtime, heartbeat
 *
 * For Anthropic: static prefix gets cache_control in system message blocks.
 * For other providers: no-op, returns full prompt as dynamic.
 */
export function splitPromptForCaching(fullPrompt: string): {
  /** Static prefix — safe to cache (identity, tooling, safety, CLI, skills). */
  staticPrefix: string;
  /** Dynamic suffix — changes per-request (workspace, context files, runtime). */
  dynamicSuffix: string;
} {
  // Split at "## Workspace" — everything before is static across sessions
  const splitMarker = "## Workspace";
  const splitIdx = fullPrompt.indexOf(splitMarker);

  if (splitIdx === -1) {
    return { staticPrefix: "", dynamicSuffix: fullPrompt };
  }

  return {
    staticPrefix: fullPrompt.slice(0, splitIdx).trimEnd(),
    dynamicSuffix: fullPrompt.slice(splitIdx),
  };
}
