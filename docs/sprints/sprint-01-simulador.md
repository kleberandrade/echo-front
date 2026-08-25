# Sprint 1 — Simulador Determinístico

**Duração:** 2 semanas · **Meta:** `packages/sim` executa partidas headless com movimento, energia e colisões, 100% determinístico e coberto por golden replays. **Marco M1.**

**Status: ✅ concluída em 2026-08-25.**

## Objetivos

1. Núcleo `step()` puro com pipeline de tick fixo ([05-simulacao.md](../05-simulacao.md)).
2. Determinismo garantido por testes automatizados.
3. Mapa `arena_alpha` v1 carregável.

## Backlog

### Núcleo
- [x] Tipos de `MatchState` (fixed-point ×1000 para posições) e `MatchConfig`.
- [x] PRNG xoshiro128** serializável + derivação de streams por subsistema; testes de sequência.
- [x] `step(state, decisions, cfg)`: aplicar decisões (ordem lexicográfica), integrar movimento, clamps de velocidade por classe.
- [x] Colisão com obstáculos/bordas e entre unidades (param adjacentes; deslizam por eixo quando possível).
- [x] Energia: regeneração base, custo de velocidade, bônus de torre de energia.
- [x] Ciclos: fechamento a cada 5 ticks, relógio de partida, fim por tempo.

### Mapa
- [x] Formato de mapa (`arena_alpha@1`): grade 64×36, obstáculos, torres de energia, zonas de interferência, spawns, núcleos — gerado com espelhamento 180° por construção (`src/map.ts`).
- [x] Validador de mapa (simetria 180°, conectividade por flood fill, pontos obrigatórios livres).

### Determinismo e ferramentas
- [x] Serialização/hash canônico do estado (`stateHash()` — JSON canônico + FNV-1a duplo).
- [x] Gravador/reprodutor de replay JSONL (header + decisões + finalHash); `resimulate()` detecta adulteração.
- [x] 3 golden replays em `fixtures/` re-simulados no CI (falha se hash divergir).
- [x] CLI `pnpm sim:run -- --seed X --cycles N --bots random,random [--out arquivo]`.
- [x] Teste de estresse com bots aleatórios sem crash nem NaN (invariantes de energia, bounds, fixed-point, sem sobreposição).

## Critérios de aceite

1. ⚠️ Mesmo seed + mesmas decisões → `finalHash` idêntico — **verificado em Node**; a verificação cruzada no browser via Playwright ficou como débito (ver abaixo). O sim usa apenas inteiros + tabelas trigonométricas quantizadas, por construção idêntico entre engines.
2. ✅ Partidas aleatórias sem violar invariantes (energia ∈ [0,max], posições dentro do mapa e fora de obstáculos, sem sobreposição de unidades) — 50 partidas no teste padrão.
3. ✅ CI executa golden replays em < 60 s (suíte completa do sim roda em ~2 s).

## Fora de escopo

Sensores, ações especiais, fragmentos, rede.

## Débitos / Retro

- **Débito — ✅ quitado na Sprint 4:** paridade Node×browser comprovada — o replay demo re-simulado no Chromium (smoke Playwright) verifica o mesmo `finalHash` gerado no Node. Mitigação que garantiu isso: aritmética 100% inteira (fixed-point + tabelas trig quantizadas ×32768), sem floats acumulados.
- **Débito:** teste de estresse usa 50 partidas (não 1000) na suíte padrão para manter o CI rápido; rodar 1000 localmente via loop do CLI quando houver mudança de física.
- **Nota:** stats das 6 classes já entraram no `MatchConfig` (velocidade/energia/integridade) para não retrabalhar na Sprint 3; apenas observer/runner são instanciadas.
- **Retro:** a decisão de gerar o mapa espelhado por construção (metade declarada + espelho automático) eliminou toda uma classe de erros de simetria — o validador nunca falhou com dados reais.
