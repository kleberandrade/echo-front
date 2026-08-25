# Sprint 4 — Visual e Replay (MVP)

**Duração:** 2 semanas · **Meta:** a partida ganha rosto: arena PixiJS no navegador, fog of war, overlays de sensores, partidas ao vivo e replay com scrubbing. Site publicado no Vercel. **Marco M3 — MVP completo.** 🎯

## Objetivos

1. Renderização da arena conforme a direção de arte ([06-espectador-e-visual.md](../06-espectador-e-visual.md)).
2. `/watch/[matchId]` ao vivo via WS e `/replay/[matchId]` com o sim rodando no browser.
3. HUD do concept: placar, cronômetro, event feed, card de unidade, minimapa.

## Backlog

### Cena PixiJS (`apps/web`)
- [ ] Projeção isométrica do mapa: plataformas, alturas, obstáculos wireframe, torres, zonas de interferência.
- [ ] Unidades geométricas por classe (Observer tetraedro, Runner obelisco…), cores de time ciano/magenta, seleção por clique.
- [ ] Interpolação 60 fps entre ticks; trilhas de movimento com decay.
- [ ] Overlays: cone de visão, anéis de som, onda de radar com flash no emissor, decoys (tracejado no modo onisciente), aura âmbar do portador de fragmento.
- [ ] Fog of war por render texture com envelhecimento de informação.
- [ ] FX: pulso de comunicação entre aliados, quebra em zona de interferência, explosão geométrica em `unit_destroyed`.

### HUD e páginas
- [ ] Layout do concept: placar/cronômetro no topo, event feed clicável à direita, card da unidade à esquerda (integrity, energy, signature, speed, sensores), barra inferior com ações/cooldowns da unidade selecionada, minimapa.
- [ ] `/watch/[matchId]`: consome canal de espectador WS.
- [ ] `/replay/[matchId]`: carrega JSONL, roda `packages/sim` no browser; timeline com scrubbing, velocidades 0.5×–8×, saltar por evento.
- [ ] Home: hero com identidade, link para replay de demonstração embutido (arquivo estático no deploy).
- [ ] Página `/docs/protocol` renderizando a referência do protocolo.

### Deploy e desempenho
- [ ] Replay de demonstração servido estático (o site funciona sem o server no ar).
- [ ] 60 fps estáveis com 8 unidades + overlays em laptop mediano; orçamento de bundle < 500 KB gzip para a cena.
- [ ] Teste Playwright: carregar replay demo, dar scrub até o fim, verificar placar final no DOM.

## Critérios de aceite

1. Qualquer pessoa com o link do Vercel assiste ao replay demo completo, com fog, sensores e event feed, sem instalar nada.
2. Scrub para qualquer ciclo reproduz o estado exato (validado contra `stateHash` amostrado).
3. Uma partida ao vivo entre dois bots é assistível pelo `/watch` com atraso < 500 ms.

## Fora de escopo

Visões por time/unidade, camada de confiança da IA (Sprint 5), térmico.

## Débitos / Retro

_(preencher ao fim da sprint)_
