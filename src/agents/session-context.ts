/**
 * Session Context Manager — auto-summarization for long conversations.
 * When context exceeds 80% of limit (80K tokens), summarizes older messages
 * using a cheap/local model (Ollama phi3 at $0).
 *
 * Target: 80K → 25K tokens = 68% reduction (from brainstorm doc).
 *
 * This is a standalone utility that can be integrated into the
 * pi-embedded-runner pipeline alongside compaction.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("jarvis:session-context");

export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Approximate token count (pre-computed or estimated). */
  tokens?: number;
}

export interface SummarizationResult {
  /** Messages after summarization (summary + recent). */
  messages: ContextMessage[];
  /** Number of messages that were summarized. */
  summarizedCount: number;
  /** Approximate tokens before summarization. */
  tokensBefore: number;
  /** Approximate tokens after summarization. */
  tokensAfter: number;
  /** Whether summarization actually occurred. */
  didSummarize: boolean;
}

export interface SessionContextConfig {
  /** Max tokens before triggering summarization (default: 80000). */
  maxContextTokens?: number;
  /** Threshold ratio to trigger summarization (default: 0.8 = 80%). */
  triggerRatio?: number;
  /** Number of recent messages to keep verbatim (default: 20). */
  keepRecentMessages?: number;
  /** Ollama base URL for summarization model. */
  ollamaBaseUrl?: string;
  /** Model to use for summarization (default: phi3 — local, $0). */
  summarizationModel?: string;
}

const DEFAULTS: Required<SessionContextConfig> = {
  maxContextTokens: 80000,
  triggerRatio: 0.8,
  keepRecentMessages: 20,
  ollamaBaseUrl: "http://localhost:11434",
  summarizationModel: "phi3",
};

/**
 * Estimate token count from text (rough: 1 token ≈ 4 chars).
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens in a message array.
 */
function totalTokens(messages: ContextMessage[]): number {
  return messages.reduce(
    (sum, msg) => sum + (msg.tokens ?? estimateTokenCount(msg.content)),
    0,
  );
}

/**
 * Check if context needs summarization.
 */
export function needsSummarization(
  messages: ContextMessage[],
  config?: SessionContextConfig,
): boolean {
  const cfg = { ...DEFAULTS, ...config };
  const total = totalTokens(messages);
  return total > cfg.maxContextTokens * cfg.triggerRatio;
}

/**
 * Summarize older messages in a conversation to reduce token usage.
 *
 * Strategy:
 * 1. Keep the last N messages verbatim (most recent context)
 * 2. Summarize everything before that into a concise recap
 * 3. Return [system summary] + [recent messages]
 */
export async function summarizeContext(
  messages: ContextMessage[],
  config?: SessionContextConfig,
): Promise<SummarizationResult> {
  const cfg = { ...DEFAULTS, ...config };
  const tokensBefore = totalTokens(messages);

  // Don't summarize if under threshold
  if (tokensBefore <= cfg.maxContextTokens * cfg.triggerRatio) {
    return {
      messages,
      summarizedCount: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
      didSummarize: false,
    };
  }

  // Split: older messages to summarize, recent to keep
  const keepCount = Math.min(cfg.keepRecentMessages, messages.length);
  const toSummarize = messages.slice(0, messages.length - keepCount);
  const recentMessages = messages.slice(messages.length - keepCount);

  if (toSummarize.length === 0) {
    return {
      messages,
      summarizedCount: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
      didSummarize: false,
    };
  }

  // Build conversation text for summarization
  const conversationText = toSummarize
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Summarize via Ollama (local, $0)
  let summary: string;
  try {
    summary = await callOllamaSummarize(
      conversationText,
      cfg.ollamaBaseUrl,
      cfg.summarizationModel,
    );
    log.info(
      `Summarized ${toSummarize.length} messages (${estimateTokenCount(conversationText)} → ${estimateTokenCount(summary)} tokens)`,
    );
  } catch (err) {
    log.warn(
      `Summarization failed, keeping original: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      messages,
      summarizedCount: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
      didSummarize: false,
    };
  }

  // Build result: summary message + recent messages
  const summaryMessage: ContextMessage = {
    role: "system",
    content: `[Context Summary — ${toSummarize.length} earlier messages]\n\n${summary}`,
    tokens: estimateTokenCount(summary),
  };

  const result = [summaryMessage, ...recentMessages];
  const tokensAfter = totalTokens(result);

  return {
    messages: result,
    summarizedCount: toSummarize.length,
    tokensBefore,
    tokensAfter,
    didSummarize: true,
  };
}

/**
 * Call Ollama to summarize conversation text.
 * Uses a cheap/local model (phi3) for $0 cost.
 */
async function callOllamaSummarize(
  conversationText: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  const prompt = `You are a conversation summarizer. Summarize the following conversation concisely, preserving:
- Key decisions and outcomes
- Important facts, names, and numbers
- Current state and pending actions
- User preferences mentioned

Keep the summary under 2000 characters. Be factual, not conversational.

CONVERSATION:
${conversationText}

SUMMARY:`;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 512,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama summarization failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { response?: string };
  return data.response?.trim() || "[Summary unavailable]";
}
