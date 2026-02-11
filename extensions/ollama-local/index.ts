import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// ─── Ollama Local: GPU-powered LLM via Tailscale ───────────
// Provider: ollama
// Default URL: http://100.116.92.48:11434/v1 (via Tailscale)
// Fallback: http://localhost:11434/v1 (if running locally)
// Cost: $0 (runs on your GPU)
// Use case: Embeddings, background agents, cheap inference

const DEFAULT_TAILSCALE_URL = "http://100.116.92.48:11434";
const DEFAULT_LOCAL_URL = "http://localhost:11434";
const DEFAULT_API_KEY = "ollama"; // Ollama doesn't require auth

// Models available on our GTX 1070 (8GB VRAM, ≤7B params)
const OLLAMA_MODEL_IDS = [
  "phi3",              // Microsoft Phi-3 3.8B — fast, good for embeddings
  "deepseek-r1:7b",   // DeepSeek R1 7B — reasoning, fits 8GB VRAM
  "llama3.2:3b",      // LLama 3.2 3B — general purpose, very fast
] as const;

function normalizeBaseUrl(value: string): string {
  let url = value.trim();
  while (url.endsWith("/")) url = url.slice(0, -1);
  if (!url.endsWith("/v1")) url = `${url}/v1`;
  return url;
}

function validateUrl(value: string): string | undefined {
  try {
    new URL(normalizeBaseUrl(value));
  } catch {
    return "Enter a valid URL (e.g. http://100.116.92.48:11434)";
  }
  return undefined;
}

function buildModelDefinition(modelId: string) {
  const isReasoning = modelId.includes("deepseek-r1") || modelId.includes("r1:");
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    reasoning: isReasoning,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8_192,  // Conservative for 8GB VRAM models
    maxTokens: 4_096,
  };
}

function resolveOllamaUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_TAILSCALE_URL;
}

const ollamaLocalPlugin = {
  id: "ollama-local",
  name: "Ollama Local",
  description: "Local GPU inference via Ollama (Tailscale tunnel) — $0 cost",
  configSchema: emptyPluginConfigSchema(),

  register(api) {
    api.registerProvider({
      id: "ollama",
      label: "Ollama (Local GPU)",
      docsPath: "/providers/models",
      auth: [
        {
          id: "tailscale",
          label: "Via Tailscale tunnel",
          hint: "Connects to Ollama on your local machine via Tailscale VPN (100.116.92.48:11434)",
          kind: "custom",
          run: async (ctx) => {
            const urlInput = await ctx.prompter.text({
              message: "Ollama URL (Tailscale IP or localhost)",
              initialValue: resolveOllamaUrl(),
              validate: validateUrl,
            });

            const modelInput = await ctx.prompter.text({
              message: "Available models (comma-separated)",
              initialValue: OLLAMA_MODEL_IDS.join(", "),
              validate: (v) =>
                v.trim().split(/[,\n]/).filter(Boolean).length > 0
                  ? undefined
                  : "Enter at least one model",
            });

            const baseUrl = normalizeBaseUrl(urlInput);
            const modelIds = modelInput.split(/[,\n]/).map((m) => m.trim()).filter(Boolean);
            const defaultModel = modelIds[0] ?? OLLAMA_MODEL_IDS[0];

            return {
              profiles: [
                {
                  profileId: "ollama:tailscale",
                  credential: {
                    type: "api_key",
                    provider: "ollama",
                    key: DEFAULT_API_KEY,
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    ollama: {
                      baseUrl,
                      apiKey: DEFAULT_API_KEY,
                      api: "openai-completions",
                      authHeader: false,
                      models: modelIds.map((id) => buildModelDefinition(id)),
                    },
                  },
                },
                agents: {
                  defaults: {
                    models: Object.fromEntries(
                      modelIds.map((id) => [`ollama/${id}`, {}]),
                    ),
                  },
                },
              },
              defaultModel: `ollama/${defaultModel}`,
              notes: [
                `Ollama URL: ${baseUrl}`,
                `Models: ${modelIds.join(", ")}`,
                "",
                "Cost: $0 — runs on your local GPU (GTX 1070, 8GB VRAM)",
                "Latency: ~196ms tunnel + 2-8s inference",
                "",
                "Best for: embeddings, background tasks, summaries",
                "NOT recommended for: interactive chat, complex code gen",
                "",
                "Ensure Ollama is running: ollama serve",
                "Ensure OLLAMA_HOST=0.0.0.0 for Tailscale access",
              ],
            };
          },
        },
        {
          id: "local",
          label: "Localhost (same machine)",
          hint: "For when Ollama runs on the same machine as OpenClaw gateway",
          kind: "custom",
          run: async (ctx) => {
            const baseUrl = normalizeBaseUrl(DEFAULT_LOCAL_URL);
            const modelIds = [...OLLAMA_MODEL_IDS];

            return {
              profiles: [
                {
                  profileId: "ollama:local",
                  credential: {
                    type: "api_key",
                    provider: "ollama",
                    key: DEFAULT_API_KEY,
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    ollama: {
                      baseUrl,
                      apiKey: DEFAULT_API_KEY,
                      api: "openai-completions",
                      authHeader: false,
                      models: modelIds.map((id) => buildModelDefinition(id)),
                    },
                  },
                },
                agents: {
                  defaults: {
                    models: Object.fromEntries(
                      modelIds.map((id) => [`ollama/${id}`, {}]),
                    ),
                  },
                },
              },
              defaultModel: `ollama/${modelIds[0]}`,
              notes: [
                `Ollama URL: ${baseUrl}`,
                "Running locally — no tunnel latency.",
              ],
            };
          },
        },
      ],
    });
  },
};

export default ollamaLocalPlugin;
