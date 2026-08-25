# Sprint 5 — Espectador Avançado e Balanceamento

**Duração:** 2 semanas · **Meta:** o diferencial de produto: ver o jogo pelos olhos de cada IA, com níveis de confiança; e um jogo comprovadamente equilibrado por simulação em massa.

**Status: ✅ concluída em 2026-08-25** — com um objetivo extra puxado pelo feedback: aproximar o visual do concept art.

## Objetivos

1. Modos de visão geral / Time A / Time B / (unidade: parcial via seleção).
2. Camada de decisão da IA no replay (campo `debug`).
3. Balanceamento orientado a dados + sensor térmico e classe Phantom.
4. **(extra)** Overhaul visual do espectador rumo ao concept (`docs/assets/concept-01.png`).

## Backlog

### Visual (extra desta sprint)
- [x] Glow real (camada duplicada com BlurFilter) em unidades, núcleos, fragmentos, decoys e pulsos.
- [x] Blocos de obstáculo wireframe translúcidos "extrudados" com arestas verticais.
- [x] Chão de circuito: pontos + grid fraco + halos de território ciano/magenta nos cantos.
- [x] Trilhas pontilhadas com seta na ponta; anéis de sonar idle nos observers; círculos pontilhados (zonas, torres, captura).
- [x] Fragmento como cristal âmbar flutuando sobre pedestal, com bob e glow (como o objetivo central do concept).
- [x] Decoy como holograma tracejado com flicker.
- [x] HUD do concept: painéis com cantos chanfrados, placar com pips, card de unidade com barras segmentadas (INTEGRITY/ENERGY/SIGNATURE/SPEED/SENSORS), action bar 1–4 com cooldowns e destaque da ação do ciclo, minimapa SVG, seletor FOG OF WAR, event feed com ícones e relógio.

### Visões e camada de confiança
- [x] Visões geral/cian/magenta (teclas 1/2/3 + botões no HUD) com fog e filtragem de percepção.
- [x] Balão de crença sobre a unidade selecionada ("72% · chase visual") derivado do `debug` do replay.
- [x] Painel "Decisão da IA" no card: modo, valores numéricos e mensagem ao time.
- [ ] Comparador "crença × realidade" com marcadores de hipóteses posicionais — adiado (débito): os bots atuais publicam direções/modos, não posições hipotéticas.

### Sensores e classes
- [x] Sensor térmico: calor por atividade, detecta unidades OCULTAS (contramedida do hide), rastros residuais de 3 ciclos (`heatTrails` no estado), torres como falso positivo intencional; atravessa obstáculos com atenuação de 50%.
- [x] Rastros de calor visíveis no modo onisciente (brasas).
- [x] Composição de times configurável (`MatchConfig.composition`, spawns extras no mapa para até 4 unidades) — Phantom instanciável.
- [x] Bot `ghost` (phantom + runner): camuflagem em vez de fuga, sinais falsos periódicos, entrega silenciosa.

### Balanceamento
- [x] Série courier × ghost (n=60, lados espelhados): **courier 43,3% × ghost 56,7%** — dentro da meta ≤65%; TODAS as vitórias do ghost sem abates (engano puro).
- [x] courier × trickster segue 49,5% × 50,5% (n=200, sprint 3 — sem mudanças de config).

## Critérios de aceite

1. ✅ Alternar visões mantém fluidez e estado consistente (fog com furos por `Graphics.cut()`).
2. ✅ Camada de confiança visível: balão sobre a unidade + painel de decisão (screenshots em `docs/assets/sprint-05-*.png`).
3. ✅ Nenhuma estratégia de referência acima de 65% (ghost 56,7%, trickster 50,5%).
4. Golden replays regenerados (estado ganhou `heatTrails`); SIM_VERSION → 0.4.0.

## Débitos / Retro

- **Débito — ✅ quitado na Sprint 7:** convenção `debug.hypotheses[] = {position, confidence, label}` implementada nos bots (hunter/trickster) e renderizada como marcadores ✕ verdes com linha de crença e seta de intenção na arena.
- **Débito:** playtest de assistibilidade com pessoas leigas — não executável neste ambiente; roteiro sugerido no doc 06.
- **Retro:** o pedido de "melhorar o visual" rendeu mais que estética: o glow e a linguagem de ícones tornaram pulso/decoy/fragmento legíveis à distância, que era a criticidade real do espectador.
