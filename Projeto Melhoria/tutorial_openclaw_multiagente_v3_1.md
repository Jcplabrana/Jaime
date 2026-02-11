# TUTORIAL COMPLETO
## Sistema Multi-Agente com OpenClaw
### Replicando a Arquitetura "Jarvis" de @jrsuzano

**Customizado para:** Intel Xeon E5-2650 v4 | 32 GB RAM | GTX 1070 8GB | 1.23 TB
**VM Local (VMware)** | GPU CUDA Compartilhada | 9 Agentes Autônomos
**Fevereiro 2026** | v3.0 — JPL Tecnologia

---

## 1. Visão Geral da Arquitetura

Este tutorial replica a arquitetura "Jarvis" demonstrada por @jrsuzano, customizada para o hardware real disponível.
O sistema roda em uma VM local VMware com acesso à GPU NVIDIA GTX 1070 para aceleração do Ollama.

### 1.1 Seu Hardware (Host Windows)

| Componente | Especificação | Uso no Projeto |
| :--- | :--- | :--- |
| Processador | Intel Xeon E5-2650 v4 @ 2.20GHz | 24 cores/48 threads — 8 vCPUs para VM, resto para host |
| RAM | 31.9 GB DDR4 @ 2400 MHz | 16 GB para VM, ~16 GB para host+GPU |
| GPU | NVIDIA GeForce GTX 1070 (8 GB VRAM) | CUDA para Ollama (embeddings Phi 2.7B) |
| Storage | 1.23 TB (722 GB usados, ~508 GB livre) | 100 GB disco virtual para VM |
| OS Host | Windows 10/11 | VMware Workstation Pro/Player |

✅ **Seu hardware é EXCELENTE para este projeto.** 32 GB RAM + GTX 1070 8GB + Xeon 24 cores dá margem de sobra para a VM + GPU compartilhada.

### 1.2 As 4 Camadas do Sistema

| Camada | Componentes | Função |
| :--- | :--- | :--- |
| Multi-Agent System | 9 agentes OpenClaw + DeepSeek V3.2 | Orquestração, execução, automação |
| VM Brain Layer | FastAPI + PostgreSQL + Redis + Ollama | Cérebro: API, banco, cache, embeddings |
| Memory Engine | L1 Redis + L2 PostgreSQL + L3 Ollama | Memória 3 camadas: rápida, persistente, semântica |
| Pipeline de Execução | Project Runner + Validation Gate | Pipelines de projeto com retry |

### 1.3 Alocação de Recursos (Seu Hardware)

| Recurso | Host Windows | VM Ubuntu | Justificativa |
| :--- | :--- | :--- | :--- |
| CPU | 16 threads livres | 8 vCPUs (16 threads) | VM replica o vídeo, host mantém performance |
| RAM | ~14 GB | 16 GB | Dobro do vídeo (7.2 GB) — menos swap necessário |
| GPU | GTX 1070 no host | Acesso via rede (Ollama no host) | CUDA real para embeddings |
| Disco | SSD principal | 100 GB disco virtual | Thin provisioned no SSD |
| Swap (VM) | — | 4 GB (como no vídeo) | Segurança para picos de uso |

⚠️ **DICA:** Com 16 GB para a VM (vs 7.2 GB do vídeo), o swap será muito menos utilizado. Mas mantenha os 4 GB de swap como segurança.

---

## 2. Estratégia de GPU: Ollama com GTX 1070

A GTX 1070 tem 8 GB VRAM com suporte CUDA (Compute Capability 6.1).
O Phi 2.7B ocupa ~2-3 GB de VRAM, deixando 5 GB livres.
A estratégia ideal é rodar o Ollama no host Windows com CUDA e a VM acessa via API de rede.

### 2.1 Por que Ollama no Host (não na VM)

❌ **IMPORTANTE:** VMware Workstation NÃO suporta GPU passthrough direto (CUDA). A VM só vê uma GPU virtual emulada.
Para usar a GTX 1070 com CUDA real, o Ollama PRECISA rodar no Windows (host).

**Arquitetura resultante:**

```text
┌───────────────────────────────────────────────────┐
│  HOST WINDOWS (DESKTOP)                           │
│  Intel Xeon E5-2650 v4 | 32 GB RAM                │
│                                                   │
│  ┌──────────────────┐    ┌─────────────────────┐  │
│  │ OLLAMA (GPU)     │    │ VM UBUNTU (VMware)  │  │
│  │ GTX 1070 CUDA    │    │ 8 vCPU | 16 GB RAM  │  │
│  │ Phi 2.7B         │    │                     │  │
│  │ Port: 11434      │───>│ OpenClaw + Brain API│  │
│  │ ~2-3 GB VRAM     │    │ PostgreSQL + Redis  │  │
│  └──────────────────┘    └─────────────────────┘  │
│           │                        │              │
│       Tailscale VPN                │              │
└────────────────────────────────────┴──────────────┘
2.2 Instalar Ollama no Windows (Host)PowerShell# 1. Instalar drivers NVIDIA atualizados
#    [https://www.nvidia.com/drivers](https://www.nvidia.com/drivers)
#    Baixar driver para GTX 1070 (Game Ready ou Studio)

# 2. Verificar CUDA no PowerShell:
nvidia-smi
# Deve mostrar: GTX 1070 | CUDA Version: 12.x

# 3. Baixar e instalar Ollama para Windows:
#    [https://ollama.com/download/windows](https://ollama.com/download/windows)
#    Executar o instalador .exe

# 4. Verificar instalação (PowerShell):
ollama --version
ollama list
2.3 Configurar Ollama para Aceitar Conexões da VMPowerShell# No Windows, configurar variável de ambiente do SISTEMA:
# Painel de Controle > Sistema > Variáveis de Ambiente
# Variáveis do Sistema > Novo:
#   Nome:  OLLAMA_HOST
#   Valor: 0.0.0.0

# Reiniciar o serviço Ollama (via PowerShell admin):
Get-Process ollama* | Stop-Process -Force

# O Ollama reinicia automaticamente, ou execute:
ollama serve

# Verificar que está escutando em todas interfaces:
netstat -an | findstr 11434
# Deve mostrar: 0.0.0.0:11434  LISTENING
2.4 Baixar o Modelo Phi 2.7BPowerShell# No PowerShell do Windows:
ollama pull phi

# Testar que está usando GPU:
ollama run phi "teste rápido"

# Verificar uso de GPU durante o teste:
nvidia-smi
# Deve mostrar uso de VRAM pelo ollama (~2-3 GB)

# Testar endpoint de embeddings:
curl http://localhost:11434/api/embeddings -d "{\"model\":\"phi\",\"prompt\":\"teste\"}"
# Deve retornar array com 2560 floats
✅ Com a GTX 1070, o Phi 2.7B gera embeddings em ~50-100ms por requisição. Muito mais rápido que CPU.2.5 Firewall do WindowsPowerShell# Liberar porta 11434 no Windows Firewall para a rede VMware:
# PowerShell (Administrador):
New-NetFirewallRule -DisplayName "Ollama API" `
  -Direction Inbound -Protocol TCP -LocalPort 11434 `
  -Action Allow -Profile Private

# Ou manualmente:
# Windows Defender Firewall > Regras de Entrada > Nova Regra
# Porta TCP 11434 > Permitir > Perfil Privado
⚠️ DICA: A rede VMware NAT usa a faixa 192.168.x.0/24. O gateway da VM (geralmente .1 ou .2) é o IP do host. Descubra com 'ip route' dentro da VM.3. Criando a VM Ubuntu no VMware3.1 Pré-requisitos no HostPlaintext# 1. Habilitar VT-x na BIOS (Intel Virtualization Technology)
#    BIOS > Advanced > CPU Configuration > VT-x: Enabled

# 2. Desabilitar Hyper-V se necessário (PowerShell Admin):
bcdedit /set hypervisorlaunchtype off
# Reiniciar o PC

# 3. VMware Workstation Pro (gratuito para uso pessoal desde 2024)
#    Download: [https://support.broadcom.com/](https://support.broadcom.com/)
#    Ou VMware Player (também gratuito)
3.2 Configuração da VMParâmetroValorJustificativaGuest OSUbuntu 64-bit (Server 24.04 LTS)LTS para estabilidadeCPUs8 cores (de 24 disponíveis)Replica o vídeo, sobra 16 threads para hostRAM16 GB (de 32 GB)Dobro do vídeo, menos dependência de swapDisco100 GB NVMe (thin provisioned)Cresce conforme uso, ~508 GB livres no hostRedeNAT (VMware)Acesso à internet + comunicação com hostDisplay3D Accel OFF, 128 MB videoServer headless, não precisa de GPU virtualUSBDesabilitadoNão necessárioSoundDesabilitadoServer, não precisa de áudioPlaintext# Download Ubuntu Server 24.04 LTS:
# [https://ubuntu.com/download/server](https://ubuntu.com/download/server)
# No VMware: File > New Virtual Machine > Custom
# Seguir o wizard com as configurações da tabela acima
# Instalar Ubuntu Server (minimal, SEM GUI)
# Selecionar: OpenSSH server durante instalação
3.3 Configuração Pós-InstalaçãoBash# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Pacotes essenciais
sudo apt install -y curl wget git build-essential htop net-tools
sudo apt install -y software-properties-common apt-transport-https
sudo apt install -y open-vm-tools  # integração VMware

# Hostname
sudo hostnamectl set-hostname jarvis-vm

# Criar usuário dedicado
sudo adduser jarvis
sudo usermod -aG sudo jarvis
su - jarvis
3.4 Swap (4 GB como no vídeo)Bash# Mesmo com 16 GB RAM, manter swap como segurança
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Swappiness baixo (16 GB RAM é suficiente, swap só emergência)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
free -h
⚠️ DICA: Com 16 GB de RAM, o swap será pouco usado (diferente do vídeo onde 99.1% do swap estava em uso com apenas 7.2 GB RAM). O swappiness=10 garante que o sistema prefere RAM.3.5 Descobrir IP do Host (Gateway VMware)Bash# Dentro da VM, descobrir o IP do host Windows:
ip route | grep default
# Resultado: default via 192.168.72.2 dev ens33
# O gateway (192.168.72.2) é geralmente o host

# Testar acesso ao Ollama no host:
curl [http://192.168.72.2:11434/api/tags](http://192.168.72.2:11434/api/tags)
# Deve listar os modelos (phi)

# Salvar como variável para referência:
export HOST_IP=$(ip route | grep default | awk '{print $3}')
echo "Host IP: $HOST_IP"
echo "export HOST_IP=$HOST_IP" >> ~/.bashrc
❌ IMPORTANTE: Se não conseguir acessar o Ollama, verifique: 1) Firewall do Windows, 2) OLLAMA_HOST=0.0.0.0 configurado, 3) Ollama rodando no host.3.6 Firewall da VMBashsudo apt install -y ufw
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 8000/tcp    # Brain API
# Redis e PostgreSQL ficam em localhost only
sudo ufw enable
sudo ufw status
4. Tailscale VPNRede mesh privada WireGuard para acessar a VM de qualquer lugar. No vídeo: 100.104.104.4.Bash# Na VM
curl -fsSL [https://tailscale.com/install.sh](https://tailscale.com/install.sh) | sh
sudo tailscale up

# Login via link no browser (copie o URL e abra no host Windows)
tailscale ip -4  # 100.x.x.x

# Instale Tailscale também no Windows (host) e celular
# para acessar a VM de qualquer rede

# Acesso SSH via Tailscale (de qualquer lugar):
ssh jarvis@100.x.x.x
5. Docker e Docker ComposeBashcurl -fsSL [https://get.docker.com](https://get.docker.com) | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
mkdir -p ~/jarvis && cd ~/jarvis
6. PostgreSQL 16 (Banco Principal)Schema "jarvis.*" com tabelas para licitações PNCP, análises e memória dos agentes (L2 Memory Engine).6.1 Docker Compose CompletoYAML# ~/jarvis/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    container_name: jarvis-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: jarvis_db
      POSTGRES_USER: jarvis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    deploy:
      resources:
        limits:
          memory: 2G

  redis:
    image: redis:7-alpine
    container_name: jarvis-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 1gb
      --maxmemory-policy allkeys-lru
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  postgres_data:
  redis_data:
⚠️ DICA: Com 16 GB de RAM na VM, aumentamos o Redis para 1 GB (vs 512 MB do setup original) para melhor cache.6.2 Script de Inicialização do BancoSQL-- ~/jarvis/init-db.sql
CREATE SCHEMA IF NOT EXISTS jarvis;

CREATE TABLE jarvis.licitacoes (
  id SERIAL PRIMARY KEY,
  pncp_id VARCHAR(100) UNIQUE,
  orgao VARCHAR(500),
  objeto TEXT,
  valor_estimado DECIMAL(15,2),
  modalidade VARCHAR(100),
  data_abertura TIMESTAMP,
  status VARCHAR(50) DEFAULT 'nova',
  embedding FLOAT8[],  -- 2560 dims (Phi 2.7B)
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jarvis.analises (
  id SERIAL PRIMARY KEY,
  licitacao_id INT REFERENCES jarvis.licitacoes(id),
  score DECIMAL(5,2),
  recomendacao TEXT,
  analise_detalhada JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jarvis.agent_memory (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(50),
  key VARCHAR(200),
  value JSONB,
  embedding FLOAT8[],
  ttl TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_licitacoes_status ON jarvis.licitacoes(status);
CREATE INDEX idx_licitacoes_data ON jarvis.licitacoes(data_abertura);
CREATE INDEX idx_agent_memory_agent ON jarvis.agent_memory(agent_name);
CREATE INDEX idx_agent_memory_key ON jarvis.agent_memory(key);
6.3 Arquivo .envBash# ~/jarvis/.env
POSTGRES_PASSWORD=sua_senha_forte_aqui
REDIS_PASSWORD=sua_senha_redis_aqui
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
PNCP_API_URL=[https://pncp.gov.br/api/consulta/v1](https://pncp.gov.br/api/consulta/v1)
# IP do host Windows (ajuste conforme sua rede VMware)
OLLAMA_URL=[http://192.168.72.2:11434](http://192.168.72.2:11434)
Bash# Subir serviços
cd ~/jarvis && docker compose up -d

# Verificar
docker ps
docker exec jarvis-postgres pg_isready
docker exec jarvis-redis redis-cli -a $REDIS_PASSWORD ping
7. Node.js 22 (Requisito OpenClaw)Bashcurl -fsSL [https://deb.nodesource.com/setup_22.x](https://deb.nodesource.com/setup_22.x) | sudo -E bash -
sudo apt install -y nodejs
node --version  # v22.x.x
npm --version   # 10.x.x
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
8. OpenClaw (Framework Multi-Agente)OpenClaw é o framework open-source que orquestra os 9 agentes. Gateway persistente (daemon) gerenciando comunicação entre agentes e LLMs.8.1 Instalação e ConfiguraçãoBash# Instalar
npm install -g openclaw
# ou: curl -fsSL [https://openclaw.dev/install.sh](https://openclaw.dev/install.sh) | sh

# Wizard de configuração
cd ~/jarvis
openclaw init

# Respostas do wizard:
# AI Provider: DeepSeek
# Model: deepseek-v3.2 (Tool-Use Loop)
# API Key: sk-xxxxxxxxxxxx
# Gateway port: 18789
# Workspace: ~/jarvis/workspace
8.2 Iniciar GatewayBashopenclaw gateway start
openclaw gateway status
openclaw doctor

# Acessar dashboard (SSH tunnel do seu PC):
# ssh -L 18789:localhost:18789 jarvis@100.x.x.x
# Abrir: http://localhost:18789
9. Sistema Multi-Agente (9 Agentes)AgentePapelIter.ToolsFunção@jarvisOrchestrator5015Coordena agentes, delega tarefas@projectsPipeline Manager3017Pipelines de projeto e execução@securitySecurity3018Segurança, auditoria, compliance@docsDocumentation3017Documentação automática@moltbookAI Social Network3020Feed social entre agentes@workspaceWorkspace Mgmt3022Gerencia arquivos e ambiente@frontendFrontend/UI5018Desenvolvimento frontend@backendBackend/API3017Desenvolvimento backend@backupBackup/Recovery3025Backup e recuperação9.1 EstruturaBashcd ~/jarvis/workspace
mkdir -p agents/{jarvis,projects,security,docs,moltbook,workspace,frontend,backend,backup}
9.2 @jarvis (Orchestrator)YAML# ~/jarvis/workspace/agents/jarvis/config.yaml
name: jarvis
role: orchestrator
description: >
  Agente orquestrador principal. Coordena todos os
  demais agentes, delega tarefas, verifica resultados.
model: deepseek-v3.2
max_iterations: 50
max_tools: 15
capabilities:
  - delegate_to: [projects, security, docs, moltbook,
                   workspace, frontend, backend, backup]
  - memory_access: full
  - brain_api: true
  - pncp_search: true
personality: >
  Profissional, eficiente, direto.
  Analisa cada solicitação e delega para o agente mais adequado.
9.3 @projects (Pipeline Manager)YAML# ~/jarvis/workspace/agents/projects/config.yaml
name: projects
role: pipeline_manager
description: >
  Gerencia pipelines de execução.
  Resolve dependências, rastreia progresso, valida resultados.
model: deepseek-v3.2
max_iterations: 30
max_tools: 17
features:
  - pipeline_daemon: true
  - no_heartbeat_wait: true
  - dependency_resolution: true
  - progress_tracking: true
⚠️ DICA: Demais 7 agentes seguem o mesmo padrão. Ajuste role, description, iterations e tools conforme a tabela.10. Brain API (FastAPI — Porta 8000)Cérebro central: conecta agentes ao PostgreSQL, Redis, Ollama (no host) e PNCP.10.1 SetupBashmkdir -p ~/jarvis/brain-api && cd ~/jarvis/brain-api
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn asyncpg aioredis httpx numpy python-dotenv pydantic
10.2 main.pyPython# ~/jarvis/brain-api/main.py
from fastapi import FastAPI
import asyncpg, aioredis, httpx, json, os, numpy as np
from dotenv import load_dotenv

load_dotenv('/home/jarvis/jarvis/.env')

app = FastAPI(title='Jarvis Brain API', version='1.0')

# OLLAMA_URL aponta para o HOST WINDOWS (GPU)
OLLAMA_URL = os.getenv('OLLAMA_URL', '[http://192.168.72.2:11434](http://192.168.72.2:11434)')
PNCP_API = os.getenv('PNCP_API_URL')

db_pool = None
redis = None

@app.on_event('startup')
async def startup():
    global db_pool, redis
    db_pool = await asyncpg.create_pool(
        f"postgresql://jarvis:{os.getenv('POSTGRES_PASSWORD')}"
        f"@localhost/jarvis_db", min_size=2, max_size=10)
    redis = await aioredis.from_url(
        f"redis://:{os.getenv('REDIS_PASSWORD')}@localhost:6379")

@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'jarvis-brain',
            'ollama': OLLAMA_URL}

@app.post('/pncp/search')
async def pncp_search(query: str, limit: int = 20):
    cache_key = f'pncp:{query}:{limit}'
    cached = await redis.get(cache_key)
    if cached: return json.loads(cached)

    async with httpx.AsyncClient() as client:
        resp = await client.get(f'{PNCP_API}/licitacoes',
            params={'q': query, 'limit': limit})
    
    data = resp.json()
    await redis.setex(cache_key, 3600, json.dumps(data))
    return data

@app.post('/memory/store')
async def memory_store(agent: str, key: str, value: dict):
    val_str = json.dumps(value)
    
    # L1: Redis
    await redis.setex(f'mem:{agent}:{key}', 3600, val_str)
    
    # L2: PostgreSQL
    async with db_pool.acquire() as conn:
        await conn.execute(
            'INSERT INTO jarvis.agent_memory (agent_name,key,value) '
            'VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            agent, key, val_str)
    
    # L3: Embedding via Ollama (GPU no host!)
    emb = await get_embedding(val_str)
    async with db_pool.acquire() as conn:
        await conn.execute(
            'UPDATE jarvis.agent_memory SET embedding=$1 '
            'WHERE agent_name=$2 AND key=$3',
            emb, agent, key)
            
    return {'status': 'stored', 'layers': ['L1','L2','L3']}

async def get_embedding(text: str) -> list:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f'{OLLAMA_URL}/api/embeddings',
            json={'model': 'phi', 'prompt': text})
    return resp.json()['embedding']  # 2560 dims
10.3 Serviço SystemdIni, TOML# sudo tee /etc/systemd/system/brain-api.service
[Unit]
Description=Jarvis Brain API
After=network.target docker.service

[Service]
User=jarvis
WorkingDirectory=/home/jarvis/jarvis/brain-api
ExecStart=/home/jarvis/jarvis/brain-api/venv/bin/uvicorn \
  main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
EnvironmentFile=/home/jarvis/jarvis/.env

[Install]
WantedBy=multi-user.target
Bashsudo systemctl daemon-reload
sudo systemctl enable brain-api
sudo systemctl start brain-api
curl http://localhost:8000/health
11. Cron Jobs (Automação)ScriptHoráriosFunçãobusca_pncp_v2.py06:00 e 18:00Busca licitações no PNCPanalyzer_autonomo.py06:30 e 18:30Analisa e pontua licitaçõesBashsudo mkdir -p /var/log/jarvis && sudo chown jarvis:jarvis /var/log/jarvis
crontab -e

# Adicionar:
0 6,18 * * * cd /home/jarvis/jarvis/brain-api && \
  venv/bin/python busca_pncp_v2.py >> /var/log/jarvis/pncp.log 2>&1

30 6,18 * * * cd /home/jarvis/jarvis/brain-api && \
  venv/bin/python analyzer_autonomo.py >> /var/log/jarvis/analyzer.log 2>&1
12. Memory Engine (3 Camadas)CamadaTecnologiaTipoCaracterísticaL1 CacheRedis 7 (1 GB)EfêmeroAcesso rápido com TTL, chaves quickkeyL2 PersistentePostgreSQL 16Persistenteagent_memory table, histórico completoL3 SemânticoOllama Phi 2.7B (GPU)EmbeddingsCosine Similarity, 2560 dimensões12.1 FunçõesFunçãoDescriçãoCamadasstore()Armazena em todas as camadasL1+L2+L3recall()Busca em cache primeiro, depois bancoL1>L2remember()Busca semântica por similaridadeL3build_context()Monta contexto completo para agenteL1+L2+L312.2 Agent Feed (Rede Social)FunçãoDescriçãopost()Agente publica no feedtimeline()Timeline de um agentefeed_summary()Resumo geral de todos os feedsKnowledge Base: JSON estruturado com APIs, Endpoints e Procedimentos consultados pelos agentes.13. Pipeline de Execução#EtapaAção1@jarvis recebeAnalisa solicitação, identifica agente2@projects pipelineCria pipeline com dependências3Runner executaDaemon executa cada etapa4Validation GateValida contra critérios de aceitação5Complete/RetryAprovado: completaProject Runner: daemon persistente com resolução de dependências, progress tracking, e no_heartbeat_wait.14. Conectando Tudo — Checklist Final#ComponenteVerificaçãoOnde Roda1Ollama + GPUcurl 192.168.72.2:11434/api/tagsHost Windows (GTX 1070)2PostgreSQLdocker exec jarvis-postgres pg_isreadyVM (Docker)3Redisdocker exec jarvis-redis redis-cli pingVM (Docker)4Brain APIcurl localhost:8000/healthVM (systemd)5OpenClawopenclaw gateway statusVM (daemon)6Tailscaletailscale statusVM (mesh VPN)7Cron Jobscrontab -lVM (crontab)14.1 Skills OpenClawBashcd ~/jarvis/workspace
openclaw skills install pncp-search --endpoint http://localhost:8000/pncp/search
openclaw skills install memory-engine --endpoint http://localhost:8000/memory
openclaw skills install licitacao-analyzer --endpoint http://localhost:8000/analyze