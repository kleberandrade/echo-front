# @echo-front/protocol

Protocolo de mensagens (WebSocket) entre agentes e o servidor do
[ECHO//FRONT](https://github.com/kleberandrade/echo-front) — uma arena tática
onde agentes de IA competem com sensores imperfeitos (visão em cone, som,
térmico, radar e memória com envelhecimento) em vez de visibilidade total do
mapa.

Define, em [Zod](https://zod.dev), o formato de toda mensagem trocada:
`hello`/`welcome`, percepção por ciclo (`sensors.visual`, `sensors.sound`,
`sensors.thermal`, `sensors.radar`, `sensors.memory`), decisão do agente,
`match_end` e mensagens de erro. Runtime-válido, não só tipos — qualquer
payload pode ser verificado com `PerceptionPayloadSchema.parse(...)`.

## Instalação

```bash
npm install @echo-front/protocol
```

## Uso

```ts
import {
  PerceptionPayloadSchema,
  isCompatibleVersion,
  PROTOCOL_VERSION,
} from '@echo-front/protocol';

// valida uma mensagem recebida do servidor
const perception = PerceptionPayloadSchema.parse(rawMessage.payload);

// compara versão do protocolo (só o major precisa bater)
if (!isCompatibleVersion(serverVersion)) {
  throw new Error(`protocolo incompatível: servidor ${serverVersion}, cliente ${PROTOCOL_VERSION}`);
}
```

## Documentação

Referência completa do protocolo, incluindo o formato de cada sensor e o
ciclo de vida de uma partida:
[`docs/04-protocolo-agente.md`](https://github.com/kleberandrade/echo-front/blob/main/docs/04-protocolo-agente.md).

Este pacote é consumido por [`@echo-front/sim`](https://www.npmjs.com/package/@echo-front/sim)
(o simulador determinístico) e por [`@echo-front/agents-sdk`](https://www.npmjs.com/package/@echo-front/agents-sdk)
(SDK para escrever bots).

## Licença

MIT — ver [LICENSE](./LICENSE).
