# ECHO//FRONT — Agents

Arena tática 2,5D onde IAs competem por percepção. Documentação em [`docs/`](./docs/README.md).

## Stack

Monorepo **pnpm + Turborepo**. TypeScript strict. Node >= 20. Package manager: `pnpm@10`.

| Path                  | Papel                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `apps/web`            | Next.js 15 + PixiJS 8 — site, espectador, replay. Deploy: Vercel      |
| `apps/server`         | NestJS — simulador autoritativo + gateway WS. Fora do Vercel          |
| `packages/sim`        | Núcleo puro e determinístico. Sem I/O, sem relógio, sem `Math.random` |
| `packages/protocol`   | Schemas Zod + tipos. Fonte canônica do contrato agente↔servidor       |
| `packages/agents-sdk` | SDK TS e bots de exemplo                                              |

## Convenções

- Docs em português. Identificadores, eventos e campos de protocolo em inglês (`pulse_scan`, `carrying_fragment`).
- TypeScript strict; `noUncheckedIndexedAccess`. Prettier: aspas simples, ponto e vírgula, trailing comma, printWidth 100.
- Lógica pura (`sim`, `protocol`) sempre com testes Vitest. Nada está "feito" sem demo reproduzível.
- Decisão de design relevante vira seção "Decisões" no doc correspondente, com data.
- Simulador autoritativo no server. `packages/sim` no browser existe só para replay.

## Comandos

```bash
pnpm install
pnpm build          # turbo: todos os packages
pnpm test           # turbo: Vitest
pnpm typecheck
pnpm dev            # web :3000, server :3001
pnpm sim:run        # CLI do simulador
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/). Escopos: `web`, `server`, `sim`, `protocol`, `agents-sdk`, `docs`, `ci`, `repo`.

```
feat(sim): apply pulse_scan energy cost and cooldown
fix(protocol): reject hello with incompatible major
docs(sprints): mark sprint 1 determinism criteria
```

Husky formata o staged (Prettier) e valida a mensagem no commit.

## Subagents

Delegar trabalho especializado:

- `sim-engineer` — `packages/sim`, determinismo, golden replay
- `protocol-engineer` — schemas Zod, versionamento SemVer
- `frontend` — Next.js, PixiJS, espectador, replay no browser
- `server` — NestJS, WebSocket, loop de partida
- `reviewer` — revisão read-only contra as regras do repo
