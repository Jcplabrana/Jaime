# ClawRouter Extension for OpenClaw

Smart LLM routing with x402 micropayments — 30+ models, ~78% cost savings.

## How It Works

ClawRouter uses a 15-dimension weighted scorer to classify each request into tiers, then routes to the cheapest model that can handle it:

| Tier | Primary Model | Fallback | Use Case |
|------|--------------|----------|----------|
| **SIMPLE** | gemini-2.5-flash | deepseek-chat | "What is 2+2?", definitions |
| **MEDIUM** | deepseek-chat | gpt-4o-mini | Summaries, translations |
| **COMPLEX** | claude-sonnet-4 | gpt-4o | Code generation, analysis |
| **REASONING** | deepseek-reasoner | o3-mini | Proofs, step-by-step logic |

Routing is 100% local (<1ms), zero external calls.

## Quick Start

```bash
# 1. Install ClawRouter (installs in ~/.openclaw/extensions/clawrouter/)
curl -fsSL https://raw.githubusercontent.com/BlockRunAI/ClawRouter/main/scripts/reinstall.sh | bash

# 2. Fund wallet with $5 USDC on Base network
#    Wallet auto-generated at ~/.openclaw/blockrun/wallet.key

# 3. Restart the gateway
openclaw gateway restart
```

Default model becomes `blockrun/auto` — smart routing active.

## Usage

```bash
# Smart routing (picks cheapest model per-request)
/model blockrun/auto

# Specific model via provider
/model blockrun/openai/gpt-4o
/model blockrun/anthropic/claude-sonnet-4
/model blockrun/deepseek/deepseek-chat

# Aliases
/model sonnet    # → anthropic/claude-sonnet-4
/model deepseek  # → deepseek/deepseek-chat
/model free      # → gpt-oss-120b ($0)
/model grok      # → xai/grok-3

# Check wallet
/wallet

# View cost stats
/stats
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BLOCKRUN_WALLET_KEY` | — | Ethereum private key (0x-prefixed). Used if no saved wallet. |
| `BLOCKRUN_PROXY_PORT` | `8402` | Local proxy port |
| `CLAWROUTER_DISABLED` | `false` | Disable ClawRouter routing |

## Custom Tier Configuration

Override default models per tier in `openclaw.yaml`:

```yaml
plugins:
  - id: "@blockrun/clawrouter"
    config:
      routing:
        tiers:
          COMPLEX:
            primary: "openai/gpt-4o"   # Use GPT-4o instead of Claude
            fallback:
              - "anthropic/claude-sonnet-4"
              - "google/gemini-2.5-pro"
```

## Architecture

```
Your App → ClawRouter (localhost:8402)
              ├── Weighted Scorer (15 dimensions, <1ms)
              ├── Model Selector (cheapest tier match)
              └── x402 Signer (USDC on Base)
                    ↓
              BlockRun API → OpenAI | Anthropic | Google | DeepSeek | xAI | Moonshot
```

## Links

- [GitHub](https://github.com/BlockRunAI/ClawRouter)
- [Docs](https://blockrun.ai/docs)
- [Models](https://blockrun.ai/models)
- [Configuration](https://github.com/BlockRunAI/ClawRouter/blob/main/docs/configuration.md)
