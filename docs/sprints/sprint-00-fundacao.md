# Sprint 0 — Fundação

**Duração:** 2 semanas · **Meta:** repositório profissional pronto para desenvolvimento contínuo, com protocolo v0.1 congelado e deploy automático do site (ainda vazio) no Vercel.

## Objetivos

1. Monorepo estruturado e ferramentado.
2. Protocolo do agente v0.1.0 formalizado em Zod (fonte: [04-protocolo-agente.md](../04-protocolo-agente.md)).
3. Pipeline de CI e deploy contínuo do `apps/web` no Vercel.

## Backlog

### Infra do monorepo
- [ ] Iniciar repo `echo-front` com pnpm workspaces + Turborepo (`apps/web`, `apps/server`, `packages/protocol`, `packages/sim`, `packages/agents-sdk`).
- [ ] TypeScript strict compartilhado (`tsconfig.base.json`), ESLint + Prettier na raiz.
- [ ] Vitest configurado em `packages/*`; script `pnpm test` na raiz via turbo.
- [ ] GitHub Actions: lint + typecheck + test em todo PR; cache do pnpm/turbo.

### Protocolo
- [ ] `packages/protocol`: schemas Zod de envelope, `perception`, `decision`, `welcome`, `match_end` + tipos inferidos exportados.
- [ ] Fixtures JSON válidas/inválidas com testes de parse (mínimo 12 casos).
- [ ] Gerar doc de referência a partir dos schemas (`pnpm protocol:docs` → markdown).

### Apps esqueleto
- [ ] `apps/web`: Next.js 15 + Tailwind, página inicial com identidade (logo ECHO//FRONT, tagline), rota `/watch/demo` placeholder.
- [ ] `apps/server`: NestJS com healthcheck HTTP e gateway WS de eco (conecta, responde `welcome` fake).
- [ ] Deploy `apps/web` no Vercel via Git integration (build do monorepo com turbo), domínio de preview funcionando.

### Qualidade/decisões
- [ ] ADR curto no fim deste arquivo para cada decisão de tooling divergente do planejado.

## Critérios de aceite

1. `pnpm i && pnpm build && pnpm test` verde em máquina limpa.
2. Push na `main` publica o site no Vercel automaticamente.
3. `wscat` conecta no server local e recebe `welcome` válido segundo o schema.
4. Protocolo v0.1.0 tem tag no repositório.

## Fora de escopo

Qualquer lógica de simulação; qualquer pixel de PixiJS além do placeholder.

## Débitos / Retro

_(preencher ao fim da sprint)_
