# @echo-front/agents-sdk

SDK para escrever bots do [ECHO//FRONT](https://github.com/kleberandrade/echo-front) —
conecta via WebSocket, valida o protocolo, e chama sua função de decisão a
cada percepção recebida. Inclui bots de referência prontos (`hunterBot`,
`wandererBot`, `courierBot`, `tricksterBot`, `ghostBot`) pra usar como
esqueleto ou adversário de teste.

## Instalação

```bash
npm install @echo-front/agents-sdk
```

## Uso

```ts
import { Agent } from '@echo-front/agents-sdk';

const agent = new Agent({
  wsUrl: 'ws://localhost:3001/agent',
  agentName: 'meu-bot',
  decide(unitId, perception) {
    // perception.sensors.visual/thermal/sound/radar/memory — ver docs/04
    return { movement: { direction: 0, speed: 0.5 } };
  },
});

agent.connect();
```

Pra rodar partidas headless entre bots (sem servidor, útil pra testar e
avaliar em lote): `runPerceptionMatch`/`batch`, exportados por
[`@echo-front/sim`](https://www.npmjs.com/package/@echo-front/sim).

## Documentação

Guia completo pra escrever um agente (protocolo, sensores, exemplos comentados):
[`docs/04-protocolo-agente.md`](https://github.com/kleberandrade/echo-front/blob/main/docs/04-protocolo-agente.md).
Os bots de referência (`hunterBot`, `wandererBot`, `courierBot`, `tricksterBot`,
`ghostBot`) ficam em [`src/bots.ts`, `src/objective-bots.ts` e `src/ghost-bot.ts`](https://github.com/kleberandrade/echo-front/tree/main/packages/agents-sdk/src) —
comentados, servem de esqueleto pra escrever o seu.

## Licença

MIT — ver [LICENSE](./LICENSE).
