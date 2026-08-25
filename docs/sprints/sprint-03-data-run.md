# Sprint 3 — Data Run Jogável

**Duração:** 2 semanas · **Meta:** o modo Data Run completo: fragmentos, ações especiais, combate mínimo e condições de vitória. Dois bots disputam partidas de 90 s de verdade. **Marco M2 — ✅ atingido.**

**Status: ✅ concluída em 2026-08-25.**

## Objetivos

1. Regras de objetivo do Data Run no `packages/sim` ([02-game-design.md](../02-game-design.md)).
2. Ações especiais do MVP: `deploy_decoy`, `hide`, `speed_boost`, `strike`, pickup implícito.
3. Bots de referência que jogam o objetivo (não só perambulam).

## Backlog

### Objetivo e fragmentos
- [x] Spawn por semente (stream PRNG `frag` escolhe entre os pontos do mapa, a cada 15 ciclos, máx. 2 ativos), evento `fragment_spawned`.
- [x] Captura implícita (2 ciclos adjacente ≤2u, sem inimigo no raio — disputa zera o progresso), transporte (−20% velocidade, som ×1,5), entrega no núcleo, drop ao morrer.
- [x] Placar, vitória por 3 entregas (`fragments_delivered`) ou tiebreak ao fim do tempo: placar → fragmentos carregados → integridade → menor energia gasta (`decideWinner`).
- [x] `objective` na percepção: score, tempo, `known_fragments` (visíveis: confiança 1.0; revelados por pulso do time: 0.7).

### Ações especiais
- [x] `deploy_decoy`: custo 20, alvo ≤4u, vive 10 ciclos; soa (0.5) e ecoa no radar como `unit` para o inimigo; morre se visto por visão direta; o próprio time não é enganado.
- [x] `hide`: custo 10, assinatura `none` por 3 ciclos, imóvel; some de visão, som e radar; quebra ao mover ou agir.
- [x] `speed_boost` (runner): 3/ciclo, velocidade ×1,6, ruído 0.6.
- [x] `strike`: alcance 3 (alvo mais próximo), dano 20, custo 15, ruído 0.9; destruição → `unit_destroyed` + drop do fragmento.
- [x] Custos/cooldowns centralizados em `MatchConfig.actions` / `.fragments` (balanceável sem tocar em código).

### Classes MVP
- [x] Atributos de Observer e Runner aplicados (tabela do game design, já no `MatchConfig.classes`).

### Bots de objetivo
- [x] `courier`: busca fragmentos (observer pulsa para achá-los), captura, entrega com boost; esquiva lateral de contato próximo; `hide` sob pulso próximo enquanto carrega.
- [x] `trickster`: decoys na direção do núcleo inimigo ("exército falso"), strike oportunista ≤2,5u, entrega furtiva sem boost, patrulha em ordem inversa.
- [x] Série de avaliação: `pnpm sim:batch -- --n 200` com lados espelhados e CSV.

## Critérios de aceite

1. ✅ Partida de 90 s courier × trickster termina com vencedor pelas regras, headless, reproduzível (teste com replay re-simulado).
2. ✅ Partida em que o trickster vence **sem destruir nenhuma unidade**: seed `series-0` fixada em teste (42 das 101 vitórias do trickster na série de 200 foram sem abates) — engano funcionando como mecânica.
3. ✅ Série de 200 (lados espelhados): **courier 49,5% × trickster 50,5%**, 0 empates — dentro da meta de ≤65%. Relatório em [balance-sprint-03.csv](../balance-sprint-03.csv).
4. ✅ Golden replays regenerados incluem o estado novo (fragments/decoys/noises); SIM_VERSION → 0.3.0.

## Calibração (registro)

O equilíbrio veio de iteração sobre os bots com o `MatchConfig` padrão intacto:
começamos em courier 100%×0% (trickster não disputava o objetivo) → trickster
híbrido (objetivo + engano) inverteu para 23%×77% → esquiva lateral (100° em
vez de fuga a 180°), `hide` só sob pulso `near` e o observer do courier
pulsando para descobrir fragmentos fecharam em 49,5%×50,5% (n=200). Nenhum
custo/alcance do config precisou mudar nesta rodada.

## Fora de escopo

UI, térmico, Warden/Phantom/Disruptor/Architect como classes completas.

## Débitos / Retro

- **Débito:** `strike` ignora o campo `target` (ataca o inimigo mais próximo no alcance); mira explícita fica para quando houver classes com alcance maior.
- **Débito:** `known_fragments` não persiste memória entre ciclos (só o que se vê/pulsa agora) — memória é responsabilidade do agente, mas o espectador pode querer exibi-la (Sprint 5).
- **Retro:** a cadeia de tiebreak transformou "prevenir entregas" numa estratégia viável — o trickster venceu partidas inteiras só negando o mapa. Exatamente o tipo de espaço estratégico que o design queria abrir.
