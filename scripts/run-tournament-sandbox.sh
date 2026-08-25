#!/usr/bin/env bash
# scripts/run-tournament-sandbox.sh — sobe o sandbox Docker do torneio de
# ponta a ponta (orquestrador + 2 agentes de exemplo) na rede `--internal`,
# do jeito que uma disputa oficial rodaria (docs/07-campeonato.md).
#
# Por que o orquestrador também roda como container: uma rede Docker
# `--internal` só garante rota entre containers da MESMA rede — não pro
# host. Então o AgentServer (apps/server/Dockerfile) sobe na própria rede
# `--internal`, e os agentes falam com ele pelo nome do container
# (`echo-front-orchestrator`), não por `host.docker.internal`.
#
# Não roda sozinho: precisa de Docker de verdade com acesso ao Docker Hub
# pra puxar a imagem base `node:20-slim` — não foi possível testar isto
# ponta a ponta no ambiente de nuvem usado no desenvolvimento (Docker Hub
# bloqueado lá). O que FOI validado sem Docker: `pnpm --filter
# @echo-front/server deploy --prod --legacy` produz um `dist/` + node_modules
# autocontidos que sobem com `node dist/main.js` e respondem `/health` —
# é exatamente o que a imagem do orquestrador (apps/server/Dockerfile) faz
# no build stage.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NETWORK="echo-front-tournament"
SERVER_IMAGE="echo-front/server:local"
AGENT_IMAGE="echo-front/sandbox-agent:demo"
ORCH_NAME="echo-front-orchestrator"

command -v docker >/dev/null 2>&1 || { echo "erro: docker não encontrado no PATH." >&2; exit 1; }

echo "==> limpando de uma rodada anterior (se houver)"
docker rm -f "$ORCH_NAME" echo-agent-demo-a echo-agent-demo-b >/dev/null 2>&1 || true

echo "==> rede isolada ($NETWORK, --internal)"
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create --internal "$NETWORK"

echo "==> build: imagem do orquestrador (apps/server/Dockerfile, contexto = raiz do repo)"
docker build -f apps/server/Dockerfile -t "$SERVER_IMAGE" .

echo "==> build: imagem de exemplo do agente (apps/server/docker/sandbox-agent)"
docker build -t "$AGENT_IMAGE" apps/server/docker/sandbox-agent

echo "==> subindo o orquestrador na rede $NETWORK (porta 3001 publicada só pra você observar)"
docker run -d --name "$ORCH_NAME" --network "$NETWORK" -p 3001:3001 "$SERVER_IMAGE"

echo "==> aguardando o orquestrador responder /health…"
for i in $(seq 1 20); do
  curl -sf http://localhost:3001/health >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:3001/health || { echo "erro: orquestrador não respondeu — 'docker logs $ORCH_NAME'" >&2; exit 1; }
echo

echo "==> subindo 2 agentes de exemplo na mesma rede, sem porta publicada"
# Sem --rm de propósito: se a partida não completar, os containers (e os
# logs deles) precisam sobreviver até o diagnóstico abaixo rodar — com
# --rm um container que crasha cedo pode sumir antes da gente conseguir
# olhar o log.
for name in echo-agent-demo-a echo-agent-demo-b; do
  docker run -d --name "$name" --network "$NETWORK" \
    --cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges \
    -e "AGENT_WS_URL=ws://${ORCH_NAME}:3001/agent" -e "AGENT_NAME=$name" \
    "$AGENT_IMAGE"
done

# Uma partida de verdade dura totalCycles × cycleMs = 180 × 500ms = 90s
# (packages/sim/src/types.ts DEFAULT_CONFIG.totalCycles, apps/server/src/
# match/agent-server.ts DEFAULT_OPTIONS.cycleMs) — um timeout de 30s aqui
# nunca completaria uma partida mesmo com tudo funcionando perfeitamente.
# 110s dá folga (90s de jogo + tempo de conexão/pareamento).
MATCH_WAIT_S=110
echo "==> aguardando uma partida terminar (até ${MATCH_WAIT_S}s — uma partida de verdade leva ~90s)…"
ok=false
for i in $(seq 1 "$MATCH_WAIT_S"); do
  n=$(curl -sf "http://localhost:3001/api/matches" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).matches.length)}catch{console.log(0)}})' 2>/dev/null || echo 0)
  if [ "${n:-0}" -gt 0 ]; then ok=true; break; fi
  if [ $((i % 15)) -eq 0 ]; then echo "   ...ainda esperando (${i}s)"; fi
  sleep 1
done

if [ "$ok" = true ]; then
  echo "✓ pelo menos 1 partida completou — sandbox Docker funcionando de ponta a ponta."
  curl -s "http://localhost:3001/api/matches" | head -c 500
  echo
  echo
  echo "==> limpeza"
  docker rm -f "$ORCH_NAME" echo-agent-demo-a echo-agent-demo-b >/dev/null 2>&1 || true
  echo "(rede '$NETWORK' mantida — 'docker network rm $NETWORK' pra remover também)"
else
  echo "✗ nenhuma partida completou em ${MATCH_WAIT_S}s. Logs (containers deixados de pé de propósito):" >&2
  for c in echo-agent-demo-a echo-agent-demo-b "$ORCH_NAME"; do
    echo >&2
    echo "--- docker logs $c ---" >&2
    docker logs "$c" 2>&1 | tail -30 >&2
  done
  echo >&2
  echo "Limpeza manual quando terminar de olhar: docker rm -f $ORCH_NAME echo-agent-demo-a echo-agent-demo-b" >&2
fi

[ "$ok" = true ]
