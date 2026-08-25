# Sprint 5 — Espectador Avançado e Balanceamento

**Duração:** 2 semanas · **Meta:** o diferencial de produto: ver o jogo pelos olhos de cada IA, com níveis de confiança; e um jogo comprovadamente equilibrado por simulação em massa.

## Objetivos

1. Modos de visão: geral / Time A / Time B / unidade ([06-espectador-e-visual.md](../06-espectador-e-visual.md)).
2. Camada de decisão da IA no replay (campo `debug`).
3. Balanceamento orientado a dados + sensor térmico e classe Phantom.

## Backlog

### Visões
- [ ] Replay grava as percepções por unidade (ou as re-deriva no browser a partir do sim) para alimentar visões por time.
- [ ] Visão Time A/B: fog real do time, decoys indistinguíveis, aliados `stale` sob interferência; teclas 1/2/3.
- [ ] Visão de unidade: HUD de percepção crua (leituras como listas/setas), câmera acoplada.
- [ ] Comparador "crença × realidade" no modo onisciente: marcadores de onde a IA acha que há inimigos vs. posições reais.

### Camada de confiança
- [ ] Painel de decisão: `debug` renderizado como balões/medidores ("72% de confiança de que existe um inimigo atrás da torre").
- [ ] Setas de intenção (decidido vs. executado) e log de mensagens de time (incluindo perdidas).
- [ ] Convenção documentada de campos `debug` recomendados no doc de protocolo (`hypotheses[]`, `confidence`, `intent`).

### Balanceamento e conteúdo
- [ ] `pnpm sim:batch` paralelo (workers) com matriz de estratégias × sementes; export CSV + notebook/relatório.
- [ ] Sensor térmico: intensidade por atividade, rastros residuais 3 ciclos, torres como falso positivo; contramedida ao `hide`.
- [ ] Classe **Phantom** jogável (camuflagem + decoy aprimorado) e bot de referência `ghost` que a usa.
- [ ] Rodada de calibração: ajustar custos/alcances até nenhuma estratégia de referência passar de 65% de winrate; registrar mudanças em Decisões do game design.

### Polimento de assistibilidade
- [ ] Playtest com 3+ pessoas leigas assistindo a um replay; roteiro de perguntas ("quem está ganhando? por quê?"); backlog de correções de legibilidade.

## Critérios de aceite

1. Alternar visões em replay mantém 60 fps e estado consistente.
2. Um clipe de 30 s demonstra uma IA perseguindo um decoy com confiança alta — visível e compreensível para leigo.
3. Relatório de balanceamento publicado em `docs/` com matriz de winrate antes/depois da calibração.

## Fora de escopo

Torneio, matchmaking, contas de usuário.

## Débitos / Retro

_(preencher ao fim da sprint)_
