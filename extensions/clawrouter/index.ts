import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// ─── ClawRouter: Smart LLM Router ──────────────────────────
// Provider: blockrun
// Default model: blockrun/auto (15-dimension weighted scoring)
// Proxy port: 8402 (OpenAI-compatible /v1/chat/completions)
// Payment: x402 micropayments (USDC on Base network)
// Docs: https://github.com/BlockRunAI/ClawRouter

const DEFAULT_PROXY_PORT = 8402;
const PROXY_AUTH_TOKEN = "x402-proxy-handles-auth";

// ─── Default tier mapping (from ClawRouter docs) ───────────
// Tier scoring is done locally in <1ms, zero external calls
const DEFAULT_TIERS = {
  SIMPLE: {
    primary: "google/gemini-2.5-flash",
    fallback: ["deepseek/deepseek-chat"],
  },
  MEDIUM: {
    primary: "deepseek/deepseek-chat",
    fallback: ["openai/gpt-4o-mini", "google/gemini-2.5-flash"],
  },
  COMPLEX: {
    primary: "anthropic/claude-sonnet-4",
    fallback: ["openai/gpt-4o", "google/gemini-2.5-pro"],
  },
  REASONING: {
    primary: "deepseek/deepseek-reasoner",
    fallback: ["openai/o3-mini", "anthropic/claude-sonnet-4"],
  },
} as const;

// All routable models via ClawRouter (30+, from blockrun.ai/models)
const BLOCKRUN_MODEL_IDS = [
  "auto",                         // Smart routing (default)
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3-mini",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-opus-4",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-reasoner",
  "xai/grok-3",
  "xai/grok-3-mini",
  "moonshot/kimi-k2.5",
] as const;

function buildModelDefinition(modelId: string) {
  const isAuto = modelId === "auto";
  const isReasoning =
    modelId.includes("reasoner") ||
    modelId.includes("o3") ||
    modelId.includes("o1");

  return {
    id: modelId,
    name: isAuto ? "Auto (Smart Routing)" : modelId,
    api: "openai-completions",
    reasoning: isReasoning,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
  };
}

function resolveProxyBaseUrl(): string {
  const port = process.env.BLOCKRUN_PROXY_PORT ?? String(DEFAULT_PROXY_PORT);
  return `http://localhost:${port}/v1`;
}

const clawrouterPlugin = {
  id: "clawrouter",
  name: "ClawRouter",
  description:
    "Smart LLM router — 30+ models, x402 micropayments, ~78% cost savings",
  configSchema: emptyPluginConfigSchema(),

  register(api) {
    api.registerProvider({
      id: "blockrun",
      label: "BlockRun (ClawRouter)",
      docsPath: "/providers/models",
      auth: [
        {
          id: "default",
          label: "x402 Proxy (auto-configured)",
          hint: "ClawRouter proxy handles authentication via x402 micropayments. Wallet auto-generated at ~/.openclaw/blockrun/wallet.key",
          kind: "custom",
          run: async (ctx) => {
            // Check if wallet already exists or prompt for it
            const existingWallet = process.env.BLOCKRUN_WALLET_KEY;

            const walletInfo = existingWallet
              ? `Using wallet from BLOCKRUN_WALLET_KEY: ${existingWallet.slice(0, 10)}...`
              : "Wallet will be auto-generated at ~/.openclaw/blockrun/wallet.key on first request";

            const baseUrl = resolveProxyBaseUrl();

            return {
              profiles: [
                {
                  profileId: "blockrun:default",
                  credential: {
                    type: "api_key",
                    provider: "blockrun",
                    key: PROXY_AUTH_TOKEN,
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    blockrun: {
                      baseUrl,
                      apiKey: PROXY_AUTH_TOKEN,
                      api: "openai-completions",
                      authHeader: false,
                      models: BLOCKRUN_MODEL_IDS.map((id) =>
                        buildModelDefinition(id),
                      ),
                    },
                  },
                },
                agents: {
                  defaults: {
                    model: {
                      primary: "blockrun/auto",
                    },
                    models: Object.fromEntries(
                      BLOCKRUN_MODEL_IDS.map((id) => [`blockrun/${id}`, {}]),
                    ),
                  },
                },
              },
              defaultModel: "blockrun/auto",
              notes: [
                "Smart routing enabled: blockrun/auto selects the cheapest model per-request.",
                walletInfo,
                `Proxy URL: ${baseUrl}`,
                "",
                "Model aliases: /model sonnet, /model deepseek, /model free, /model grok",
                "Specific models: blockrun/openai/gpt-4o, blockrun/anthropic/claude-sonnet-4",
                "",
                "Default tier mapping:",
                `  SIMPLE    → ${DEFAULT_TIERS.SIMPLE.primary}`,
                `  MEDIUM    → ${DEFAULT_TIERS.MEDIUM.primary}`,
                `  COMPLEX   → ${DEFAULT_TIERS.COMPLEX.primary}`,
                `  REASONING → ${DEFAULT_TIERS.REASONING.primary}`,
                "",
                "Fund wallet: Send $5 USDC to your wallet on Base network.",
                "Check wallet: /wallet in any conversation.",
              ],
            };
          },
        },
      ],
    });
  },
};

export default clawrouterPlugin;
