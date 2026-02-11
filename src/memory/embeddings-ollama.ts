/**
 * Ollama Embedding Provider for OpenClaw Jarvis Edition.
 * Cost: $0 (local GPU — GTX 1070 on host via Tailscale).
 * Pattern: follows embeddings-openai.ts interface.
 */

import type { EmbeddingProvider, EmbeddingProviderOptions } from "./embeddings.js";

export type OllamaEmbeddingClient = {
  baseUrl: string;
  model: string;
};

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = "phi3";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export function resolveOllamaModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_OLLAMA_EMBEDDING_MODEL;
  }
  if (trimmed.startsWith("ollama/")) {
    return trimmed.slice("ollama/".length);
  }
  return trimmed;
}

export async function createOllamaEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<{ provider: EmbeddingProvider; client: OllamaEmbeddingClient }> {
  const remote = options.remote;
  const baseUrl = (remote?.baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(
    /\/$/,
    "",
  );
  const model = resolveOllamaModel(options.model);

  const client: OllamaEmbeddingClient = { baseUrl, model };

  const embed = async (input: string[]): Promise<number[][]> => {
    if (input.length === 0) {
      return [];
    }
    // Ollama /api/embed supports batch via "input" array
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ollama embeddings failed: ${res.status} ${text}`);
    }
    const payload = (await res.json()) as {
      embeddings?: number[][];
    };
    return payload.embeddings ?? [];
  };

  // Verify Ollama is reachable and model is available
  try {
    const healthRes = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!healthRes.ok) {
      throw new Error(`Ollama not reachable at ${baseUrl}`);
    }
    const tags = (await healthRes.json()) as {
      models?: Array<{ name: string }>;
    };
    const models = tags.models?.map((m) => m.name) ?? [];
    const hasModel = models.some((m) => m.includes(model));
    if (!hasModel) {
      throw new Error(
        `Ollama model '${model}' not found. Available: ${models.join(", ")}`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Ollama")) {
      throw err;
    }
    throw new Error(
      `Ollama unavailable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    provider: {
      id: "ollama",
      model,
      embedQuery: async (text) => {
        const [vec] = await embed([text]);
        return vec ?? [];
      },
      embedBatch: embed,
    },
    client,
  };
}
