# Sprint 8 — Temporada 1: Novos Modos e Elo

**Duração:** 1–2 semanas · **Meta:** abrir o espaço estratégico além do Data Run — os dois modos seguintes do game design — e dar ao leaderboard um rating de força relativa.

**Status: ✅ concluída em 2026-08-25.**

## Entregas

### Modo Core Siege (`mode: 'core_siege'`)
- Núcleos com **posição sorteada por semente** entre pares espelhados do mapa (`map.coreSites`) — o "localizar" do modo: nenhum time sabe qual par foi escolhido até sentir.
- Núcleo inimigo só aparece na **visão a curta distância** (`coreVisionRange: 10`) e no eco de radar (`type: 'core'` — protocolo 0.4.0).
- Núcleos têm **integridade (100)**; `strike` no alcance causa 20 de dano ao núcleo (prioridade pela mira `target`); evento `core_hit:<team>`.
- Vitória por `core_destroyed`; no tempo, vence quem preservou mais o próprio núcleo (novo primeiro elo da cadeia de tiebreak).
- Sem fragmentos; o espectador desenha os núcleos DO ESTADO, com barra de integridade, destroços quando destruídos, e visibilidade limitada nas visões por time.

### Modo Silent Hunt (`mode: 'silent_hunt'`)
- Data Run com **cota de `pulse_scan` por unidade** (`sensors.maxPulsesPerMatch`; 0 = ilimitado). Além da cota, o pulso vira no-op — informação ativa vira recurso finito.

### Elo no leaderboard
- Rating **Elo (K=32, inicial 1000)** computado partida a partida da sequência de resultados no `MatchStore`; coluna ELO no `/leaderboard` e no payload da API.
- Temporada 1 (torneio amistoso): **trickster 1154 · courier 1047 · ghost 991 · hunter 808** — o Elo separa courier de ghost (que os pontos aproximavam) por qualidade de oponente.

## Infra
- Protocolo **0.4.0** (aditivo): `'core'` nos enums de leitura visual/radar, `'core_destroyed'` em match_end.
- SIM **0.6.0**: estado ganhou `mode`, `corePositions`, `coreIntegrity`, `pulsesUsed`; goldens regenerados. `objective.mode` na percepção agora reflete o modo real.
- 96 testes no repo (6 novos de modos: sorteio determinístico de núcleos, visibilidade curta, destruição/vitória, cota de pulsos).

## Débitos / Próximos
- **Débito:** nenhum bot de referência joga o objetivo do core_siege (os testes dirigem decisões manualmente); um bot `raider` habilitaria torneios no modo.
- **Débito:** `silent_hunt` não expõe a cota restante na percepção (o agente precisa contar os próprios pulsos) — candidato a campo `objective.pulses_left` num protocolo futuro.
- Herdados da Sprint 7: npm publish do SDK, sandbox Docker, rate limit por IP.

## Retro
Sortear a posição do núcleo transformou o Core Siege num jogo de reconhecimento: as primeiras dezenas de ciclos são puro sensoriamento — exatamente a identidade do projeto aplicada a um segundo modo.
