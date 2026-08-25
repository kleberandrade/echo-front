# Sandbox agent — exemplo

Imagem de referência para o sandbox Docker do torneio oficial
(`docs/07-campeonato.md`). `agent.mjs` é a implementação mínima e
autocontida do lado do cliente do protocolo (docs/04) — não depende de
`@echo-front/protocol` nem `@echo-front/agents-sdk` (não publicados no npm),
só do pacote `ws`. Qualquer competidor pode usar este arquivo como esqueleto
para o próprio bot.

## Build

```bash
cd apps/server/docker/sandbox-agent
docker build -t echo-front/sandbox-agent:demo .
```

## Rodar via o orquestrador

```ts
import { ContainerOrchestrator } from '../../src/tournament/container-orchestrator.js';

const orch = new ContainerOrchestrator();
await orch.start({
  image: 'echo-front/sandbox-agent:demo',
  containerName: 'echo-agent-demo-cian',
  wsUrl: 'ws://host.docker.internal:3001/agent', // AgentServer rodando no host
  agentName: 'demo-cian',
});
// ... partida acontece ...
await orch.stop('echo-agent-demo-cian');
```

`ContainerOrchestrator` aplica os limites do contrato (1 vCPU, 512 MB,
`--cap-drop ALL`, rede `--internal` sem saída para a internet) — ver
`container-orchestrator.ts`.

## Nota sobre verificação nesta sessão

O ambiente de nuvem desta sessão bloqueia pull do Docker Hub
(`registry-1.docker.io` retorna 403 pelo proxy de rede) — não deu para
`docker build`/`docker run` esta imagem de ponta a ponta aqui. O que FOI
verificado neste ambiente, de verdade:

- `docker network create --internal` funciona (a rede isolada é criada e
  `Internal: true` é confirmado via `docker network inspect`).
- `ContainerOrchestrator` tem 7 testes unitários cobrindo a construção dos
  comandos (`runArgs`, `networkCreateArgs`) e o ciclo de vida
  (`ensureNetwork`/`start`/`stop`/`stopAll`) contra um `CommandRunner` fake.
- `agent.mjs` foi executado como processo Node puro (fora de container,
  sem Docker) contra um `AgentServer` real rodando localmente: conectou,
  recebeu percepções, tomou decisões e completou uma partida com hash de
  replay válido — ou seja, o protocolo do lado do cliente está correto.

O que falta verificar é só a camada de empacotamento Docker em si (`docker
build` + `docker run` com os limites) — em qualquer máquina com acesso
normal ao Docker Hub, os dois comandos acima (`docker build` seguido de
`orch.start(...)`) devem funcionar sem ajuste.
