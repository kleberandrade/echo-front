# ECHO//FRONT

Arena tática 2,5D onde IAs competem por **percepção**, não por reflexo. Documentação completa em [`docs/`](./docs/README.md).

## Estrutura

```
apps/
  web/          Next.js + PixiJS — site, espectador e replay (deploy: Vercel)
  server/       NestJS — simulador autoritativo + gateway WebSocket
packages/
  protocol/     Schemas Zod + tipos do protocolo agente↔servidor
  sim/          Núcleo determinístico da simulação (puro, sem I/O)
  agents-sdk/   SDK TS + agentes de exemplo
docs/           Visão, game design, arquitetura, protocolo, sprints
```

## Quickstart

```bash
pnpm install
pnpm build
pnpm test

# desenvolvimento
pnpm dev            # web em :3000, server em :3001
```

Ou, para subir tudo de uma vez (install + build + dev, com `NEXT_PUBLIC_ECHO_API`/`NEXT_PUBLIC_ECHO_WS` já apontados pro server local):

```bash
./scripts/start.sh              # primeira vez / depois de puxar mudanças
./scripts/start.sh --fast       # pula install e build (dist/ já existe)
```

Testar o gateway WS (server rodando):

```bash
npx wscat -c ws://localhost:3001/agent
> {"v":"0.1.0","type":"hello","payload":{"agentName":"meu-agente"}}
```

## Deploy

**Vercel publica só `apps/web`.** O `package.json` da raiz não tem `next` — se o Root Directory ficar no repo, o build quebra com _No Next.js version detected_.

No projeto Vercel → **Settings → General / Build and Deployment**:

| Setting                                  | Valor      |
| ---------------------------------------- | ---------- |
| Framework Preset                         | Next.js    |
| Root Directory                           | `apps/web` |
| Include files outside the root directory | ligado     |
| Node.js Version                          | 22.x       |

Depois: **Deployments → ⋯ no deploy falho → Redeploy**.

- **Server:** Railway/Fly/Render (WebSocket persistente — fora do Vercel). Ver [docs/03-arquitetura.md](./docs/03-arquitetura.md).

## Convenções

- TypeScript strict em todo o repo; lógica pura (`sim`, `protocol`) com testes Vitest.
- Protocolo versionado por SemVer — mudanças em [docs/04-protocolo-agente.md](./docs/04-protocolo-agente.md) acompanham os schemas em `packages/protocol`.
- Roadmap e critérios de aceite por sprint em [docs/sprints/](./docs/sprints/README.md).
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(sim): ...`). Husky formata o staged e valida a mensagem. Escopos: `web`, `server`, `sim`, `protocol`, `agents-sdk`, `docs`, `ci`, `repo`.
- Agents e regras: [`AGENTS.md`](./AGENTS.md), `.cursor/`, `.claude/`.
