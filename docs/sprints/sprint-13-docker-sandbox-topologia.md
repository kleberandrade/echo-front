# Sprint 13 — Sandbox Docker: Corrige Topologia de Rede

**Duração:** curta (um item de correção) · **Meta:** revisitar o sandbox Docker (débito deixado por último de propósito nas sprints 11/12) e corrigir um problema de topologia de rede encontrado ao revisar o design com mais calma.

**Status: ✅ concluída em 2026-08-25.**

## O problema encontrado

`ContainerOrchestrator` (sprint-11) cria uma rede Docker `--internal` para isolar os agentes competidores da internet, conforme `docs/07-campeonato.md`. O README de exemplo apontava `AGENT_WS_URL` para `ws://host.docker.internal:3001/agent`, assumindo que o container conseguiria alcançar o AgentServer rodando no host.

Isso nunca tinha sido testado de ponta a ponta (o ambiente de nuvem usado no desenvolvimento bloqueia pull do Docker Hub, então essa parte ficou documentada como pendente desde a sprint-11). Revisando o design com mais cuidado: uma rede `--internal` só garante rota entre containers _da mesma rede_ — ela não instala rota padrão pra fora, e isso inclui a rota especial que resolveria `host.docker.internal`, pelo menos em Docker Engine (Linux). Ou seja: o exemplo documentado tinha uma chance real de simplesmente não funcionar — o container nunca conseguiria discar de volta pro orquestrador.

## A correção

O único destino que uma rede `--internal` garante alcançável é _outro container da mesma rede_. Então o orquestrador (`AgentServer`) passa a rodar como container, na mesma rede `--internal` que os competidores, endereçado pelo nome (DNS interno do Docker) em vez de `host.docker.internal`:

- **`apps/server/Dockerfile`** (novo): imagem de produção do orquestrador. Multi-stage: builda `protocol`/`sim`/`server` com `pnpm`, empacota com `pnpm --filter @echo-front/server deploy --prod --legacy /out` (produz um `dist/` + `node_modules` autocontidos, sem symlinks de workspace) e roda `node dist/main.js` numa imagem final enxuta.
- **`.dockerignore`** (novo, raiz do repo): evita copiar `node_modules`/`dist`/`.git` pro contexto de build.
- **`scripts/run-tournament-sandbox.sh`** (novo): automatiza o fluxo inteiro — cria a rede, builda as duas imagens (orquestrador + agente de exemplo), sobe o orquestrador na rede com a porta publicada só pra observação humana, sobe 2 agentes de exemplo _sem_ porta publicada, espera uma partida terminar e reporta sucesso/falha.
- `container-orchestrator.ts` e o README do `sandbox-agent`: comentário e exemplo corrigidos para a nova topologia (container→container, não container→host).

## O que foi validado sem depender de Docker

Nem o ambiente de nuvem nem o acesso ao Mac do usuário usado nesta sessão têm Docker Hub liberado — então, de novo, não deu pra rodar `docker build`/`docker run` de ponta a ponta aqui. Mas a peça central da correção (o build stage do `apps/server/Dockerfile`) usa só `pnpm`, sem Docker — e essa parte **foi** testada direto: `pnpm --filter @echo-front/server deploy --prod --legacy /tmp/out` seguido de `node dist/main.js` a partir do diretório gerado, isolado do monorepo, subiu o NestJS de pé e respondeu `/health` e `/api/queue` corretamente. Dá alta confiança de que o Dockerfile funciona — falta só confirmar a camada de container em si numa máquina com Docker Hub liberado, rodando `./scripts/run-tournament-sandbox.sh`.

## Verificação

- `pnpm build` / `pnpm -r test`: sem mudança de comportamento em código de produção (só o Dockerfile/script novos e um comentário corrigido) — 126 testes, todos verdes.
- `pnpm --filter @echo-front/server deploy --prod --legacy` + `node dist/main.js`: validado manualmente, servidor de pé respondendo `/health`.
- **Rodado de verdade** (fora deste ambiente, numa máquina com Docker/OrbStack, pelo usuário): `./scripts/run-tournament-sandbox.sh` ponta a ponta, em 3 rodadas sucessivas, cada uma corrigindo o problema encontrado na anterior — ver "Bugs encontrados rodando de verdade" abaixo. Na 3ª rodada, com os dois bugs corrigidos, uma partida completou de ponta a ponta dentro do sandbox Docker: rede `--internal`, orquestrador containerizado, dois agentes competidores conectando, pareando e disputando uma partida de `data_run` até `time_up`, com replay verificável.

## Bugs encontrados rodando de verdade (e corrigidos)

Rodar o script numa máquina com Docker de verdade revelou dois problemas que nenhuma verificação sem Docker (mocks, `pnpm deploy` isolado, testes unitários) poderia ter pego:

1. **Build do Dockerfile faltava `agents-sdk`**: `tournament.ts` importa os _tipos_ de `@echo-front/agents-sdk`, então o `tsc` do server quebrava com `Cannot find module '@echo-front/agents-sdk'` — a cadeia de build do `apps/server/Dockerfile` só buildava `protocol`, `sim` e `server`. Reproduzido sem Docker (apagando os `dist/` dos packages e rodando a mesma cadeia de comandos) e corrigido adicionando `pnpm --filter @echo-front/agents-sdk build` à cadeia.
2. **Corrida de inicialização: agente sem retry de conexão.** Com o build corrigido, o orquestrador subia e respondia `/health`, mas a partida não completava — os logs mostraram um agente com `ECONNREFUSED` (tentou conectar antes do orquestrador estar pronto pra aceitar conexões na rede interna, mesmo já respondendo `/health` pela porta publicada no host) e o outro agente conectado, sozinho, esperando um adversário que nunca chegaria. `apps/server/docker/sandbox-agent/agent.mjs` conectava exatamente uma vez, sem retry — uma falha transitória de conexão deixava o agente permanentemente fora do torneio. Corrigido com reconexão com backoff (1s, 2s, 3s... até um teto de 5s, até 30 tentativas). Reproduzido e verificado sem Docker: dois agentes apontados pra uma porta ainda sem servidor nenhum escutando, com o servidor subindo alguns segundos depois — ambos os agentes levaram o `ECONNREFUSED` inicial, reconectaram sozinhos assim que o servidor existiu, e a série pareou normalmente.
   - Efeito colateral encontrado no mesmo processo: o timeout de "aguardar partida completar" do script era de 30s, mas uma partida de verdade dura `totalCycles × cycleMs` = 180 × 500ms = **90s** — ou seja, o script nunca teria reportado sucesso mesmo com tudo funcionando. Corrigido para 110s (90s de jogo + folga pra conexão/pareamento), com uma linha de progresso a cada 15s pra não parecer travado.

## Débitos / Próximos

- Herdados: publicação de `protocol`/`sim`/`agents-sdk` no npm; fog com envelhecimento de informação; playtest com pessoas de fora do projeto.

## Retro

Vale destacar por que isso não foi pego antes: a sprint-11 documentou honestamente "não deu pra testar isso aqui" — o que é o comportamento certo — mas "não testado" e "provavelmente funciona" acabaram se misturando na cabeça de quem lia o README (inclusive nesta sessão, até essa revisão). Documentar a limitação de verificação não é a mesma coisa que revisar o design assumindo que ele pode estar errado. Encontrar isso só aconteceu porque, ao preparar um script de verificação de verdade (`run-tournament-sandbox.sh`) e pensar no que ele precisaria fazer passo a passo, ficou óbvio que "container conecta no host" era uma suposição não verificada, não um fato.
