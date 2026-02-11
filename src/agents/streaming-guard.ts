/**
 * Streaming Guard — detects repetition and enforces token limits.
 * Part of Task 3.4: Response Streaming + Early Termination.
 *
 * Features:
 * - Repetition detection (similarity > 0.8 in last 200 chars)
 * - Safety limit (3000 tokens max per response)
 * - Auto-abort when loop detected
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("jarvis:streaming-guard");

export interface StreamingGuardConfig {
  /** Max tokens before force-stopping (default: 3000). */
  maxTokens?: number;
  /** Window size in chars for repetition detection (default: 200). */
  windowSize?: number;
  /** Similarity threshold to trigger abort (default: 0.8). */
  similarityThreshold?: number;
  /** Minimum chars before repetition checking starts (default: 400). */
  minCharsBeforeCheck?: number;
}

const DEFAULTS: Required<StreamingGuardConfig> = {
  maxTokens: 3000,
  windowSize: 200,
  similarityThreshold: 0.8,
  minCharsBeforeCheck: 400,
};

export interface GuardResult {
  shouldAbort: boolean;
  reason?: "repetition" | "token_limit";
  detail?: string;
}

/**
 * Monitors streaming output for repetition and excessive length.
 * Create one per streaming response.
 */
export class StreamingGuard {
  private config: Required<StreamingGuardConfig>;
  private buffer = "";
  private estimatedTokens = 0;

  constructor(config?: StreamingGuardConfig) {
    this.config = { ...DEFAULTS, ...config };
  }

  /**
   * Feed a new chunk of streaming output.
   * Returns whether the stream should be aborted.
   */
  check(chunk: string): GuardResult {
    this.buffer += chunk;
    this.estimatedTokens += Math.ceil(chunk.length / 4);

    // Check token limit
    if (this.estimatedTokens >= this.config.maxTokens) {
      log.warn(
        `Token limit reached: ${this.estimatedTokens} >= ${this.config.maxTokens}`,
      );
      return {
        shouldAbort: true,
        reason: "token_limit",
        detail: `Response exceeded ${this.config.maxTokens} token safety limit`,
      };
    }

    // Check repetition (only after minimum chars accumulated)
    if (this.buffer.length >= this.config.minCharsBeforeCheck) {
      const windowSize = this.config.windowSize;
      if (this.buffer.length >= windowSize * 2) {
        const recent = this.buffer.slice(-windowSize);
        const previous = this.buffer.slice(-windowSize * 2, -windowSize);
        const similarity = computeSimilarity(recent, previous);

        if (similarity >= this.config.similarityThreshold) {
          log.warn(
            `Repetition detected: similarity=${similarity.toFixed(3)} >= ${this.config.similarityThreshold}`,
          );
          return {
            shouldAbort: true,
            reason: "repetition",
            detail: `Repetition loop detected (similarity: ${(similarity * 100).toFixed(1)}%)`,
          };
        }
      }
    }

    return { shouldAbort: false };
  }

  /** Get current estimated tokens. */
  getTokenCount(): number {
    return this.estimatedTokens;
  }

  /** Get accumulated buffer length. */
  getBufferLength(): number {
    return this.buffer.length;
  }

  /** Reset the guard for a new stream. */
  reset(): void {
    this.buffer = "";
    this.estimatedTokens = 0;
  }
}

/**
 * Compute character-level similarity between two strings.
 * Uses bigram overlap (Dice coefficient) for fast comparison.
 */
function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
