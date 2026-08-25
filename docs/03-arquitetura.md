# 03 — Arquitetura

## Visão geral

Monorepo **pnpm workspaces + Turborepo**. O simulador é **autoritativo e roda no servidor** (NestJS); o front (Next.js + PixiJS) apenas renderiza estado e replays. Agentes conectam-se ao servidor por WebSocket.

```
echo-front/
├── apps/
│   ├── web/            # Next.js 15 (App Router) + PixiJS 8 — deploy no Vercel
│   └── server/         # NestJS — simulador autoritativo + gateway WS (deploy fora do Vercel)
├── packages/
│   ├── protocol/       # Tipos TS + schemas Zod do protocolo (percepção/decisão/replay)
│   ├── sim/            # Núcleo da simulação: puro, determinístico, sem I/O
│   └── agents-sdk/     # SDK TS de referência + agentes de exemplo (bots)
├── docs/               # Esta documentação
├── turbo.json
└── pnpm-workspace.yaml
```

### Por que `packages/sim` separado do server

O núcleo da simulação é uma função pura `step(state, decisions, rng) → state'`, sem timers, sem rede, sem Date.now. Isso permite: rodar no NestJS (partidas ao vivo), rodar em worker/CLI para simulação em massa e balanceamento, e **rodar no navegador** para scrubbing de replay sem servidor — essencial para o site no Vercel funcionar de forma barata.

## apps/web (Vercel)

- **Next.js 15**, App Router, TypeScript, Tailwind.
- **PixiJS 8** para a arena (WebGL): camadas para mapa, fog of war, unidades, trilhas, overlays de sensores, decoys.
- Páginas: home/landing, `/watch/[matchId]` (ao vivo via WS), `/replay/[matchId]` (arquivo de replay + `packages/sim` no cliente), `/docs` (protocolo renderizado), `/leaderboard` (pós-MVP).
- Estado de UI: Zustand. Dados: fetch de arquivos de replay estáticos (MVP) → API do server (pós-MVP).
- No MVP, replays podem ser servidos como JSON estático do próprio repositório/storage — o site no Vercel funciona mesmo sem o server no ar.

## apps/server (NestJS)

- **Gateway WebSocket** (`@nestjs/websockets` + ws): salas de partida, canal de agentes, canal de espectadores.
- **MatchService**: cria partidas, injeta semente, roda o loop de ticks chamando `packages/sim`, aplica timeout de decisão (350 ms → no-op).
- **ReplayService**: grava todo input/output por ciclo em um arquivo de replay (JSONL comprimido) — o replay é a lista de decisões + semente, não snapshots.
- **AgentRegistry** (pós-MVP): autenticação de agentes por token, filas de matchmaking, sandbox/limites.
- Deploy: Railway/Fly.io/Render (WebSocket de longa duração não é o caso de uso do Vercel). O Vercel hospeda somente `apps/web`.

## Agentes

- Conectam por **WebSocket** falando o protocolo JSON de [04-protocolo-agente.md](./04-protocolo-agente.md).
- Qualquer linguagem; `packages/agents-sdk` oferece o caminho rápido em TS.
- Torneios (pós-MVP): submissão por container Docker executado pelo orquestrador, com CPU/RAM/latência limitadas — remove vantagem de rede e permite partidas offline reproduzíveis.

## Determinismo

Regras invioláveis do `packages/sim`:

1. PRNG próprio (mulberry32/xoshiro) semeado pela semente da partida; **proibido** `Math.random`, `Date.now`, iteração de `Map`/`Set` sem ordem definida.
2. Ordem de aplicação de decisões fixa: por `unitId` lexicográfico.
3. Aritmética em inteiros/fixed-point onde houver risco de divergência de float.
4. Teste de **golden replay** no CI: replays canônicos re-simulados a cada commit; qualquer divergência de estado quebra o build.

## Fluxo de uma partida ao vivo

```
agentes ──WS──▶ server (coleta decisões do ciclo, timeout 350ms)
                  │  step(state, decisions, rng)
                  ├─▶ percepções filtradas por unidade ──WS──▶ agentes
                  ├─▶ estado de espectador (fog opcional) ──WS──▶ web /watch
                  └─▶ ReplayService (JSONL: seed + decisões + eventos)
```

## Fluxo de replay

```
web /replay ── fetch replay.jsonl ──▶ packages/sim no browser
             └─ scrub/velocidade/rewind = re-simular do início até o ciclo N
             └─ overlays: percepções e confiança gravadas no replay
```

## Stack resumida

| Camada | Tecnologia |
|---|---|
| Front | Next.js 15, React 19, PixiJS 8, Tailwind, Zustand |
| Server | NestJS 11, ws, Zod |
| Núcleo | TypeScript puro (`packages/sim`), sem dependências de runtime |
| Protocolo | JSON + Zod schemas versionados (`packages/protocol`) |
| Monorepo | pnpm + Turborepo |
| Qualidade | Vitest (sim/protocol), Playwright (web), ESLint, CI GitHub Actions |
| Deploy | Vercel (web) · Railway/Fly (server) |

## Decisões

- 2026-08-25 — Simulador no servidor, nunca no cliente para partidas válidas: impede trapaça e garante fonte única de verdade; o sim no browser existe só para replay.
- 2026-08-25 — Replay = semente + decisões (event sourcing), não snapshots: arquivos pequenos, verificáveis e à prova de adulteração (re-simular valida o resultado).
- 2026-08-25 — Vercel só para o front: WebSockets persistentes e loops de tick não se encaixam em serverless.
