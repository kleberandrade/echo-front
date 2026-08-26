# 08 — Deploy e CI/CD

## Visão geral

| Peça                                   | Onde                      | Como                                          |
| -------------------------------------- | ------------------------- | --------------------------------------------- |
| `apps/web` (site + replays)            | **Vercel**                | Git integration, deploy a cada push na `main` |
| `apps/server` (partidas ao vivo + API) | Railway / Fly.io / Render | Node 22, processo longo com WebSocket         |
| CI (typecheck, build, testes, smoke)   | **GitHub Actions**        | `.github/workflows/ci.yml`                    |

## Vercel (apps/web)

Configuração única no painel da Vercel:

1. **Import** do repositório `kleberandrade/echo-front`.
2. **Root Directory:** `apps/web` (com "Include source files outside of the Root Directory" habilitado — é o padrão).
3. Framework Next.js é detectado; o `apps/web/vercel.json` já define:
   - `installCommand: pnpm install --frozen-lockfile` (instala o workspace inteiro);
   - `buildCommand: cd ../.. && pnpm turbo run build --filter=@echo-front/web` (o turbo constrói `protocol` e `sim` antes do site — o Next resolve os pacotes do workspace pelo `dist/`).
4. Variáveis de ambiente (opcionais):
   - `NEXT_PUBLIC_ECHO_API` → URL do server (ex.: `https://echo-server.fly.dev`). Sem ela, `/leaderboard` e `/matches` usam os JSONs estáticos do torneio em `public/data/` — o site funciona 100% sem server.
   - `NEXT_PUBLIC_ECHO_WS` → URL do canal de espectador (ex.: `wss://echo-server.fly.dev/spectate`) para o `/watch/demo` ao vivo.
   - `NEXT_PUBLIC_SITE_URL` → domínio público do site (ex.: `https://echo-front.seudominio.com`), usado em `metadataBase`, `og:url`, `robots.txt` e `sitemap.xml` (`app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`). Sem ela, cai no fallback `https://echo-front.vercel.app` — **defina assim que o domínio de produção existir**, senão o link de compartilhamento (og:image, etc.) aponta pro lugar errado.

A cada push na `main`, a Vercel faz build e publica; PRs ganham preview deployments automaticamente. O CI do GitHub roda em paralelo como portão de qualidade (a proteção de branch pode exigir o check `ci` verde antes do merge).

## SEO e favicon

- **Favicon e ícones** (`app/icon.tsx`, `app/apple-icon.tsx`): gerados via `next/og` (`ImageResponse`) em vez de arquivos estáticos — o desenho (anel ciano + ponto magenta, a mesma paleta de `globals.css`) fica no próprio código, sem depender de editor de imagem pra ajustar. O Next detecta esses arquivos automaticamente e injeta `<link rel="icon">`/`<link rel="apple-touch-icon">` no `<head>`.
- **Imagem de compartilhamento** (`app/opengraph-image.tsx`, 1200×630): mesma técnica — usada como `og:image` e `twitter:image` (card `summary_large_image`) em qualquer link do site compartilhado no Slack/Twitter/WhatsApp/etc.
- **Metadados** (`app/layout.tsx`): título com template (`%s · ECHO//FRONT` pras páginas internas), descrição, `openGraph`/`twitter`, `robots: { index: true, follow: true }`, `metadataBase` (ver `NEXT_PUBLIC_SITE_URL` acima).
- **`robots.txt`/`sitemap.xml`** (`app/robots.ts`, `app/sitemap.ts`): convenção de arquivo do Next — libera indexação geral e lista as rotas estáticas (`/`, `/compete`, `/leaderboard`, `/matches`, `/watch/demo`). `/replay/[id]` fica de fora de propósito (uma URL por partida disputada, efêmera — o buscador chega lá a partir do link em `/matches`).

## Server (apps/server)

O simulador autoritativo precisa de processo persistente (loop de ticks + WebSocket) — fora do modelo serverless da Vercel. Em Railway/Fly/Render:

```bash
# build
pnpm install --frozen-lockfile && pnpm turbo run build --filter=@echo-front/server
# start
node apps/server/dist/main.js        # PORT no env; /health para o healthcheck
```

Persistência: dois modos, mesma interface (`Store`, `apps/server/src/match/store.ts` — pensada desde a sprint-06 pra essa troca sem tocar no resto).

- **Sem `DATABASE_URL`** (padrão): arquivos em disco (`data/agents.json`, `data/results.jsonl`, `data/replays/*.replay.jsonl`). Monte um volume no diretório de trabalho — sem ele, o histórico não sobrevive a um redeploy/restart.
- **Com `DATABASE_URL`** (sprint-15): Postgres via `PgMatchStore` (`store-pg.ts`), ligado automaticamente por `AgentServer.initStore()`. Schema (`agents`/`results`/`replays`) é criado sob demanda na primeira query — não precisa rodar migração antes do primeiro deploy.

### Neon (Postgres gerenciado)

O usuário já adicionou a integração Neon×Vercel no projeto `apps/web`. Isso **não** configura `apps/server` sozinho — a integração cria o banco e injeta `DATABASE_URL` só nas env vars do projeto Vercel, e `apps/server` roda em Railway/Fly/Render, não na Vercel. Passo manual necessário:

1. No painel da Vercel, projeto do `apps/web` → Settings → Environment Variables → copiar o valor de `DATABASE_URL` (ou `POSTGRES_URL`, dependendo de como a integração nomeou) gerado pela integração Neon.
2. Colar esse valor como `DATABASE_URL` nas env vars da plataforma que roda `apps/server` (Railway/Fly/Render).
3. Redeploy do server — no próximo boot, `initStore()` detecta a env var e troca `FileMatchStore` por `PgMatchStore` automaticamente, sem mudança de código.

Sem esse passo manual, `apps/server` continua no `FileMatchStore` (disco) — o Neon adicionado na Vercel fica sem uso até `DATABASE_URL` ser copiado pra lá.

Para transmissão com delay anti-coaching, configure `agentServer.configure({ spectateDelayMs: 30000 })` no bootstrap (ou exponha via env quando necessário).

## CI (GitHub Actions)

`.github/workflows/ci.yml`, dois jobs:

1. **ci** — `pnpm typecheck` + `pnpm build` + `pnpm test` (protocol, sim com golden replays, agents-sdk, server com e2e de séries). Sobe um serviço `postgres:16` e define `TEST_DATABASE_URL`, então os testes do `PgMatchStore` (`store-pg.test.ts`, `agent-server.pg.e2e.test.ts`) rodam de verdade em vez de serem pulados.
2. **smoke** — instala o Chromium do Playwright, sobe o site buildado e reproduz o replay demo: valida o placar renderizado após scrub e o `finalHash` re-simulado **no browser** (paridade Node×browser a cada commit). Screenshots sobem como artifact do workflow.

## Checklist de release

1. `pnpm test` e `pnpm --filter @echo-front/web smoke` verdes localmente.
2. Se o sim mudou de comportamento: golden replays regenerados e `SIM_VERSION` atualizado; replay demo regenerado (`pnpm --filter @echo-front/web gen:demo`).
3. Se o torneio/agentes mudaram: `pnpm --filter @echo-front/server tournament` para atualizar `public/data` e os replays publicados.
4. Push na `main` → CI verde → Vercel publica.
