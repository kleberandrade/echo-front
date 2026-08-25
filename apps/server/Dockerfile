# Imagem de produção do orquestrador (AgentServer) — sprint-12.
#
# Existe pra resolver um problema de topologia descoberto ao revisar o
# sandbox Docker da sprint-11: a rede `--internal` criada por
# ContainerOrchestrator (docs/07-campeonato.md) não garante rota pro HOST —
# `--internal` desliga qualquer rota padrão pra fora da própria rede bridge,
# e isso inclui `host.docker.internal` em pelo menos parte das
# implementações (Docker Engine em Linux, por exemplo). O único destino
# que uma rede `--internal` garante alcançável é OUTRO CONTAINER na MESMA
# rede — daí o orquestrador (este Dockerfile) precisa rodar como container
# na mesma rede que os agentes competidores, não no host.
#
# Build a partir da RAIZ do monorepo (precisa enxergar os workspace
# packages via pnpm):
#   docker build -f apps/server/Dockerfile -t echo-front/server:local .
#
# Rodar na rede do torneio (ver docs/07-campeonato.md e
# scripts/run-tournament-sandbox.sh):
#   docker network create --internal echo-front-tournament
#   docker run -d --name echo-front-orchestrator --network echo-front-tournament \
#     -p 3001:3001 echo-front/server:local
#   # agentes competidores usam AGENT_WS_URL=ws://echo-front-orchestrator:3001/agent
#   # ("echo-front-orchestrator" resolve via DNS interno do Docker dentro da
#   # mesma rede — não depende de host.docker.internal nem de internet)

FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @echo-front/protocol build \
 && pnpm --filter @echo-front/sim build \
 && pnpm --filter @echo-front/server build
# --legacy: workspace deps (protocol, sim) copiados como arquivos reais em
# node_modules em vez de symlinks — necessário pra funcionar fora do
# monorepo, na imagem final abaixo. Validado nesta sprint (sem Docker: só
# `pnpm deploy` + `node dist/main.js` rodando de pé, respondendo /health).
RUN pnpm --filter @echo-front/server deploy --prod --legacy /out

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /out ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
