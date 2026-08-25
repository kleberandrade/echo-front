---
description: Convenções do front Next.js + PixiJS
alwaysApply: false
paths: apps/web/**/*.ts, apps/web/**/*.tsx, apps/web/**/*.css
---

# apps/web

Next.js 15 App Router, React 19, Tailwind, PixiJS 8. Deploy só deste app no Vercel (Root Directory `apps/web`).

- Sem lógica de partida válida no cliente. `packages/sim` no browser = replay/scrub
- UI: Zustand. Replay MVP pode ser JSON/JSONL estático
- Identidade visual: fundo escuro, `cian` / `magenta` / `amber`, `font-mono` na marca
- Arena PixiJS em camadas: mapa, fog, unidades, trilhas, overlays de sensores, decoys
- Rotas previstas: `/`, `/watch/[matchId]`, `/replay/[matchId]`, `/docs`
- `transpilePackages`: `@echo-front/protocol`, `@echo-front/sim`
- Não apontar WebSocket persistente do server para hospedar no Vercel
