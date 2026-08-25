#!/usr/bin/env bash
# scripts/start.sh — sobe o ambiente de dev completo do ECHO//FRONT.
#
#   ./scripts/start.sh                 # install + build + dev (server :3001, web :3000)
#   ./scripts/start.sh --skip-install  # pula "pnpm install"
#   ./scripts/start.sh --skip-build    # pula "pnpm build" (usa dist/ já existente)
#   ./scripts/start.sh --fast          # atalho para --skip-install --skip-build
#
# Por que precisa de build antes do dev: packages/{protocol,sim,agents-sdk}
# não têm modo watch — apps/server e apps/web importam o `dist/` compilado
# deles via workspace:*, então se esse dist/ não existir (primeiro clone) ou
# estiver desatualizado, o dev quebra ou usa código velho.
#
# Não sobe Docker: isso aqui é só o ambiente de dev local (server + web
# rodando direto como processos Node, sem container). O sandbox Docker do
# torneio oficial é outra coisa, opcional, separada — ver
# ./scripts/run-tournament-sandbox.sh e docs/07-campeonato.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_INSTALL=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --fast) SKIP_INSTALL=true; SKIP_BUILD=true ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "argumento desconhecido: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

# --- pnpm ---------------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "==> pnpm não encontrado no PATH — tentando via corepack…"
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "erro: pnpm não encontrado e corepack não resolveu. Instale o Node >=20 com corepack, ou 'npm i -g pnpm'." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ] 2>/dev/null; then
  echo "aviso: este projeto pede Node >=20 (engines em package.json); detectado: $(node -v 2>/dev/null || echo 'desconhecido')." >&2
fi

# --- install --------------------------------------------------------------
if [ "$SKIP_INSTALL" = false ]; then
  echo "==> pnpm install"
  pnpm install
else
  echo "==> pnpm install (pulado — --skip-install)"
fi

# --- build ------------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
  echo "==> pnpm build (protocol, sim, agents-sdk, server, web)"
  pnpm build
else
  echo "==> pnpm build (pulado — --skip-build)"
  for pkg in packages/protocol packages/sim packages/agents-sdk; do
    if [ ! -d "$pkg/dist" ]; then
      echo "erro: $pkg/dist não existe — rode sem --skip-build ao menos uma vez." >&2
      exit 1
    fi
  done
fi

# --- env de dev -----------------------------------------------------------
# Sem isso o site usa os JSONs estáticos em apps/web/public/data/*; com isso
# ele lê leaderboard/partidas ao vivo do server local.
export NEXT_PUBLIC_ECHO_API="${NEXT_PUBLIC_ECHO_API:-http://localhost:3001}"
export NEXT_PUBLIC_ECHO_WS="${NEXT_PUBLIC_ECHO_WS:-ws://localhost:3001/spectate}"

cat <<EOF

==> subindo em modo dev
    server  http://localhost:3001   (WS: /agent, /spectate · REST: /health, /api/*)
    web     http://localhost:3000
    Ctrl+C encerra os dois.
    (sandbox Docker do torneio é separado: ./scripts/run-tournament-sandbox.sh)

EOF

exec pnpm dev
