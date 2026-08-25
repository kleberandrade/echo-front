# @echo-front/sim

Simulador determinístico da arena tática do [ECHO//FRONT](https://github.com/kleberandrade/echo-front):
movimento, energia, fragmentos, ações especiais (decoy, hide, boost, strike),
sensores com ruído reproduzível (RNG derivado de seed+ciclo+ouvinte+fonte) e
fog com envelhecimento (memória de última posição vista de um inimigo, que
decai até expirar). Puro TypeScript, sem I/O — o mesmo código roda em Node
(servidor de partidas) e no browser (verificação de replay no cliente).

Qualquer partida é **100% reproduzível**: dado o mesmo `seed` e a mesma
sequência de decisões, `stepCycle` produz sempre o mesmo estado final —
verificado por hash canônico (`stateHash`) e por replays golden no CI.

## Instalação

```bash
npm install @echo-front/sim
```

## Uso

```ts
import {
  createMatch,
  stepCycle,
  buildPerceptions,
  DEFAULT_CONFIG,
  ARENA_ALPHA,
} from '@echo-front/sim';

let state = createMatch('minha-seed', ARENA_ALPHA, DEFAULT_CONFIG);

while (!state.ended) {
  const perceptions = buildPerceptions(state, ARENA_ALPHA, DEFAULT_CONFIG);
  const decisions = decideForEachUnit(perceptions); // seu código de agente
  state = stepCycle(state, decisions, ARENA_ALPHA, DEFAULT_CONFIG).state;
}
```

## Documentação

Regras completas da simulação (ciclo de tick, sensores, ações, modos de
jogo): [`docs/05-simulacao.md`](https://github.com/kleberandrade/echo-front/blob/main/docs/05-simulacao.md).
Usa tipos de [`@echo-front/protocol`](https://www.npmjs.com/package/@echo-front/protocol)
para o formato de percepção/decisão.

## Licença

MIT — ver [LICENSE](./LICENSE).
