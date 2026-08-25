# Sprint 2 — Sensores e Agentes

**Duração:** 2 semanas · **Meta:** unidades percebem o mundo por visão, som e radar; agentes externos conectam por WebSocket e jogam de verdade.

**Status: ✅ concluída em 2026-08-25.**

## Objetivos

1. Modelo de sensores do MVP implementado no `packages/sim` ([05-simulacao.md](../05-simulacao.md)).
2. Gateway WS do server rodando partidas ao vivo com timeout de decisão.
3. `packages/agents-sdk` com dois bots de referência.

## Backlog

### Sensores (`packages/sim`)
- [x] Visão: cone por classe (observer 120°/18, demais 90°/14), raycast com oclusão, `class_guess` + `confidence` por distância (quantizada em 0,05; abaixo de 0,5 vira leitura `movement`).
- [x] Som: fontes por movimento, atenuação de 40% por obstáculo, jitter ±25° via stream PRNG `sound` (derivado de seed+ciclo+ouvinte+fonte — reproduzível sem consumir o rngState).
- [x] Radar `pulse_scan`: snapshot quantizado 2×2, custo 25 (observer 15), cooldown 5 ciclos, leitura `pulse_origin` para todos + evento global.
- [x] Comunicação: fila de `message_to_team` (entrega no ciclo seguinte), zonas de interferência descartam envios e marcam `allies` como `stale`.
- [x] Montagem do pacote `perception` por unidade (`buildPerceptions`, derivada — não altera o estado).
- [x] Testes: oclusão, cone, alcance, jitter reproduzível e limitado, custo/cooldown do pulso, interferência (11 testes de sensores).

### Server (NestJS)
- [x] Núcleo framework-free `AgentServer`/`LiveMatch` (gateways Nest apenas delegam — testável sem metadata de DI).
- [x] Lobby de 2 agentes → partida com loop real (500 ms/ciclo, configurável); decisões não recebidas até o fechamento do ciclo viram no-op (timeout implícito).
- [x] Handshake `hello`/`welcome` com unitIds do time; `match_start`; percepções roteadas por unidade; validação Zod com `error` tipado.
- [x] Canal de espectador `/spectate` com estado onisciente por ciclo (formato provisório — ver débitos).
- [x] Replay JSONL gravado em disco ao fim da partida (`replays/<id>.replay.jsonl`).

### Agentes de referência (`packages/agents-sdk`)
- [x] SDK: classe `Agent` responde percepções automaticamente via `onPerception`.
- [x] Bot `wanderer`: patrulha determinística + fuga de leituras fortes + aviso ao time.
- [x] Bot `hunter`: persegue visual > radar > som; `pulse_scan` quando energia > 60.
- [x] Harness: `pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots wanderer,hunter`.

## Critérios de aceite

1. ✅ Partida ao vivo wanderer × hunter roda ponta a ponta pelo WS com replay gravado que re-simula com `finalHash` idêntico (teste e2e com sockets reais).
2. ✅ Derrubar um agente no meio da partida não trava o loop (e2e: time cai, partida termina normalmente).
3. ✅ Assimetria de informação demonstrada: hunter dispara `pulse_scan`, o wanderer detecta o `pulse_origin` e foge (teste em `bots.test.ts`).

## Fora de escopo

Fragmentos, decoy/hide, térmico, qualquer UI.

## Débitos / Retro

- **Golden replays regenerados** (mudança intencional): o `MatchState` ganhou `messages`, `pulses`, `cycleEvents` e `cooldowns`, alterando o hash canônico. Novos hashes em `golden.test.ts`; SIM_VERSION → 0.2.0.
- **Débito:** formato do canal `/spectate` é provisório (estado bruto, sem schema no protocol); formalizar na Sprint 4 junto com o front.
- **Débito:** `allies` com `stale: true` ainda carrega posições atuais (não o último snapshot conhecido); histórico de posições fica para quando houver demanda real do espectador.
- **Retro:** separar `AgentServer` (puro) dos gateways Nest permitiu e2e com sockets reais sem tocar em `emitDecoratorMetadata` no vitest — decisão a manter.
