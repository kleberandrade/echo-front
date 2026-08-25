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

**Importante (sprint-13):** uma rede Docker `--internal` só garante rota
entre containers da MESMA rede — não pro host. `host.docker.internal` não é
garantido dentro de uma rede `--internal` (não é em Docker Engine/Linux).
Por isso o `wsUrl` do agente deve apontar pra **outro container na mesma
rede**, não pro host — e esse outro container é o próprio orquestrador
(`AgentServer`), empacotado em `apps/server/Dockerfile`:

```ts
import { ContainerOrchestrator } from '../../src/tournament/container-orchestrator.js';

const orch = new ContainerOrchestrator();
await orch.ensureNetwork(); // cria a rede --internal se ainda não existir
// o orquestrador roda como container NA MESMA rede (apps/server/Dockerfile),
// com --name echo-front-orchestrator — ver scripts/run-tournament-sandbox.sh
// pro fluxo completo (rede + orquestrador + agentes, tudo containerizado).
await orch.start({
  image: 'echo-front/sandbox-agent:demo',
  containerName: 'echo-agent-demo-cian',
  wsUrl: 'ws://echo-front-orchestrator:3001/agent', // nome do container, não host.docker.internal
  agentName: 'demo-cian',
});
// ... partida acontece ...
await orch.stop('echo-agent-demo-cian');
```

Pra ver isso rodando de ponta a ponta (rede + orquestrador + 2 agentes de
exemplo, tudo automatizado): `./scripts/run-tournament-sandbox.sh` na raiz
do repo.

`ContainerOrchestrator` aplica os limites do contrato (1 vCPU, 512 MB,
`--cap-drop ALL`, rede `--internal` sem saída para a internet) — ver
`container-orchestrator.ts`.

## Nota sobre verificação

O ambiente de nuvem usado no desenvolvimento (e o VM isolado usado pra
acessar o Mac do desenvolvedor a partir daqui) bloqueiam pull do Docker Hub
(`registry-1.docker.io` retorna 403 pelo proxy de rede nos dois) — não deu
pra rodar `docker build`/`docker run` de ponta a ponta em nenhum dos dois. O
que FOI verificado de verdade, sem depender de Docker:

- `docker network create --internal` funciona (a rede isolada é criada e
  `Internal: true` é confirmado via `docker network inspect`).
- `ContainerOrchestrator` tem 7 testes unitários cobrindo a construção dos
  comandos (`runArgs`, `networkCreateArgs`) e o ciclo de vida
  (`ensureNetwork`/`start`/`stop`/`stopAll`) contra um `CommandRunner` fake.
- `agent.mjs` foi executado como processo Node puro (fora de container,
  sem Docker) contra um `AgentServer` real rodando localmente: conectou,
  recebeu percepções, tomou decisões e completou uma partida com hash de
  replay válido — ou seja, o protocolo do lado do cliente está correto.
- **(sprint-13)** `apps/server/Dockerfile` usa `pnpm --filter
@echo-front/server deploy --prod --legacy /out` no build stage — esse
  comando específico FOI validado sem Docker: rodado direto neste ambiente,
  produziu um `dist/` + `node_modules` autocontidos (workspace deps
  `protocol`/`sim` copiados como arquivos reais) que sobem com `node
dist/main.js` sem o monorepo por perto e respondem `/health` e
  `/api/queue` corretamente.
- **(sprint-13)** a topologia de rede foi corrigida: antes, o exemplo deste
  README apontava `wsUrl` pra `host.docker.internal`, que não é garantido
  numa rede `--internal`. Agora o orquestrador roda como container na mesma
  rede (`apps/server/Dockerfile`), e os agentes o alcançam pelo nome do
  container — elimina a dependência de conectividade host↔container que
  nunca tinha sido verificada de verdade.

O que falta verificar, numa máquina com acesso normal ao Docker Hub: os
`docker build` das duas imagens e `./scripts/run-tournament-sandbox.sh` de
ponta a ponta — o script foi escrito pra rodar sozinho e reportar
sucesso/falha claramente (não precisa entender os comandos, só rodar).
