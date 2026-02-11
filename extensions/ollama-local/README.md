# Ollama Local Extension for OpenClaw

Local GPU-powered LLM provider via Tailscale tunnel. Cost: **$0**.

## Architecture

```
VPS (OpenClaw Gateway) → Tailscale VPN (196ms) → Host Local → Ollama → GTX 1070
```

## Setup

### 1. Ensure Ollama is running on Host Local

```bash
# Allow connections from Tailscale
export OLLAMA_HOST=0.0.0.0
ollama serve
```

### 2. Verify access from VPS

```bash
curl http://100.116.92.48:11434/api/tags
```

### 3. Configure in OpenClaw

The extension will prompt for the Ollama URL during `openclaw auth` setup.

## Models (GTX 1070, 8GB VRAM)

| Model | Params | Use Case | Speed |
|-------|--------|----------|-------|
| `phi3` | 3.8B | Embeddings, simple tasks | ~2s |
| `deepseek-r1:7b` | 7B | Reasoning, analysis | ~5-8s |
| `llama3.2:3b` | 3B | General purpose | ~1.5s |

## Usage

```bash
# Use Ollama for specific requests
/model ollama/phi3
/model ollama/deepseek-r1:7b

# Per-agent config in openclaw.yaml
agents:
  list:
    - id: docs
      model: { primary: ollama/phi3 }
    - id: backup
      model: { primary: ollama/phi3 }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://100.116.92.48:11434` | Ollama server URL |
