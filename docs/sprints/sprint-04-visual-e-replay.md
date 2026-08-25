# Sprint 4 — Visual e Replay (MVP)

**Duração:** 2 semanas · **Meta:** a partida ganha rosto: arena PixiJS no navegador, fog of war, overlays de sensores, partidas ao vivo e replay com scrubbing. Site publicado no Vercel. **Marco M3 — MVP completo. 🎯**

**Status: ✅ concluída em 2026-08-25** (deploy no Vercel: passo manual do repositório — ver nota abaixo).

## Objetivos

1. Renderização da arena conforme a direção de arte ([06-espectador-e-visual.md](../06-espectador-e-visual.md)).
2. `/watch/demo` ao vivo via WS e `/replay/demo` com o sim rodando no browser.
3. HUD: placar, cronômetro, event feed, card de unidade com a decisão da IA.

## Backlog

### Cena PixiJS (`apps/web`)
- [x] Projeção isométrica por matriz (mundo 64×36): grid, obstáculos "extrudados" 2,5D, zonas de interferência, torres de energia, núcleos.
- [x] Unidades geométricas por classe (observer triângulo, runner losango), cores ciano/magenta, indicador de rumo, barra de integridade, seleção por clique.
- [x] Interpolação 60 fps entre ciclos (lerp de posições no ticker).
- [x] Trilhas de movimento com decay (últimas 22 posições).
- [x] Overlays: cones de visão, onda expansiva de radar (anel duplo animado no emissor), anéis de ruído (strike/boost), aura âmbar do portador, decoys com contorno tracejado + marca no modo onisciente.
- [x] Fog of war nas visões por time: overlay escuro com furos (`Graphics.cut()`) nos cones, proximidade e pulsos do time; inimigos só aparecem se percebidos (reusa `inVisionCone`/`hasLineOfSight` do sim no browser).
- [x] Modos de visão geral/cian/magenta nas teclas 1/2/3 (adiantado da Sprint 5).

### HUD e páginas
- [x] Placar/cronômetro no topo, event feed clicável (salta a timeline), card da unidade à esquerda, painel "Decisão da IA" com o campo `debug` do replay, timeline com scrubbing e velocidades 0.5×–8×, espaço pausa.
- [x] `/replay/[id]`: carrega JSONL estático, roda `packages/sim` no browser, pré-computa os 180 estados (scrub instantâneo) e **verifica o `finalHash` no cliente** (badge "replay verificado ✓").
- [x] `/watch/demo`: espectador ao vivo via canal `/spectate` (URL em `NEXT_PUBLIC_ECHO_WS`), com os mesmos modos de visão.
- [x] Home com links para o replay demo e o ao vivo.
- [ ] Página `/docs/protocol` renderizada — adiado (débito).

### Deploy e verificação
- [x] Replay demo estático em `public/replays/demo.replay.jsonl` (`pnpm --filter @echo-front/web gen:demo`) — courier × magenta trickster, seed `series-3`, 1×3 com vitória por entregas.
- [x] Smoke Playwright (`pnpm --filter @echo-front/web smoke`): sobe o site buildado, reproduz o replay, dá scrub até o fim, valida placar/fim renderizados e o hash verificado, captura screenshots (inclusive da visão por time).
- [x] **Paridade Node×browser comprovada** (débito da Sprint 1 quitado): o hash re-simulado no Chromium bate com o gerado no Node.
- [ ] Deploy no Vercel: importar o repo com Root Directory `apps/web` (ação manual na conta Vercel).

## Critérios de aceite

1. ✅ Replay demo completo assistível no navegador com fog, sensores e event feed, servido estático (funciona sem o server no ar).
2. ✅ Scrub para qualquer ciclo reproduz o estado exato (estados pré-computados pelo próprio sim; hash final validado no cliente).
3. ✅ Partida ao vivo assistível via `/watch/demo` conectado ao canal `/spectate` (atraso = 1 ciclo de broadcast).

## Fora de escopo

Camada "crença × realidade" e térmico (Sprint 5); leaderboard (Sprint 6).

## Débitos / Retro

- **Débito:** página `/docs/protocol` (referência renderizada) ficou de fora — entra na Sprint 6 junto do guia do competidor.
- **Débito — ✅ quitado na Sprint 7:** o CI ganhou o job `smoke` que instala o Chromium do Playwright e valida o replay demo (placar + hash) a cada push; screenshots viram artifact.
- **Débito:** fog não tem "envelhecimento" da informação (memória do que já foi visto) — só o campo sensorial atual; o replay grava o suficiente para adicionar depois.
- **Retro:** rodar o sim no browser pagou o investimento em determinismo: scrubbing instantâneo com 180 estados pré-computados em <100 ms e verificação de hash no cliente de graça.
