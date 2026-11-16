# Imagem de exemplo para o sandbox do torneio oficial (docs/07-campeonato.md).
# Contrato: expõe um processo que conecta em AGENT_WS_URL (env, injetada pelo
# orquestrador) e fala o protocolo de agente (docs/04). Sem porta exposta —
# é o container quem disca para o orquestrador, nunca o contrário.
FROM node:24-slim

WORKDIR /agent
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY agent.mjs .

# Sem HEALTHCHECK/EXPOSE de propósito: o orquestrador controla o ciclo de
# vida via `docker stop`, não via probes HTTP.
CMD ["node", "agent.mjs"]
