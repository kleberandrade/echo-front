# 08 — Deploy e CI/CD

## Visão geral

| Peça | Onde | Como |
|---|---|---|
| `apps/web` (site + replays) | **Vercel** | Git integration, deploy a cada push na `main` |
| `apps/server` (partidas ao vivo + API) | Railway / Fly.io / Render | Node 22, processo longo com WebSocket |
| CI (typecheck, build, testes, smoke) | **GitHub Actions** | `.github/workflows/ci.yml` |

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

A cada push na `main`, a Vercel faz build e publica; PRs ganham preview deployments automaticamente. O CI do GitHub roda em paralelo como portão de qualidade (a proteção de branch pode exigir o check `ci` verde antes do merge).

## Server (apps/server)

O simulador autoritativo precisa de processo persistente (loop de ticks + WebSocket) — fora do modelo serverless da Vercel. Em Railway/Fly/Render:

```bash
# build
pnpm install --frozen-lockfile && pnpm turbo run build --filter=@echo-front/server
# start
node apps/server/dist/main.js        # PORT no env; /health para o healthcheck
```

Persistência em disco (`data/`): monte um volume no diretório de trabalho (os replays e o results.jsonl vivem ali). Para transmissão com delay anti-coaching, configure `agentServer.configure({ spectateDelayMs: 30000 })` no bootstrap (ou exponha via env quando necessário).

## CI (GitHub Actions)

`.github/workflows/ci.yml`, dois jobs:

1. **ci** — `pnpm typecheck` + `pnpm build` + `pnpm test` (protocol, sim com golden replays, agents-sdk, server com e2e de séries).
2. **smoke** — instala o Chromium do Playwright, sobe o site buildado e reproduz o replay demo: valida o placar renderizado após scrub e o `finalHash` re-simulado **no browser** (paridade Node×browser a cada commit). Screenshots sobem como artifact do workflow.

## Checklist de release

1. `pnpm test` e `pnpm --filter @echo-front/web smoke` verdes localmente.
2. Se o sim mudou de comportamento: golden replays regenerados e `SIM_VERSION` atualizado; replay demo regenerado (`pnpm --filter @echo-front/web gen:demo`).
3. Se o torneio/agentes mudaram: `pnpm --filter @echo-front/server tournament` para atualizar `public/data` e os replays publicados.
4. Push na `main` → CI verde → Vercel publica.
