# Sprint 11 — Infra de Torneio, Visual e Landing

**Duração:** curta (três itens paralelos) · **Meta:** quitar os dois débitos de infra de torneio pendentes desde a Sprint 6/7 (sandbox Docker, rate limit por IP), comparar o visual da arena com a arte-conceito original, e melhorar a landing page (`/`).

**Status: ✅ concluída em 2026-08-25.**

## Entregas

### Rate limiting por IP (`apps/server`)

Débito desde a Sprint 6/7: o canal WS público (`/agent` e `/spectate`) não tinha nenhuma proteção contra flood de conexões.

- `IpRateLimiter` (`src/match/rate-limiter.ts`): janela deslizante de 60s por IP (`maxConnectionsPerMinute`) + teto de conexões simultâneas (`maxConcurrentPerIp`), com `release()` liberando vaga no fechamento. `extractIp()` prioriza `x-forwarded-for` e cai para `request.socket.remoteAddress`.
- `AgentServer` ganhou `agentRateLimit`/`spectatorRateLimit` nas opções (padrão: 60 conexões/min e 20 simultâneas por IP no canal de agentes; 120/min e 40 simultâneas no de espectadores). Conexão recusada recebe o código de erro `rate_limited` já existente no protocolo — sem bump de versão — e é fechada.
- Conexões sem IP (partidas headless/torneio local) não passam pelo limitador — só o canal WS público precisa da proteção.
- `agent.gateway.ts`/`spectator.gateway.ts` passam a extrair o IP do `IncomingMessage` bruto que o `WsAdapter` do NestJS já entrega como segundo argumento de `handleConnection`.
- 12 testes novos (`rate-limiter.test.ts` + `agent-server.ratelimit.test.ts`): teto concorrente, liberação de vaga, janela deslizante com tempo injetado, IPs independentes, bypass sem IP, limite também no canal de espectador.

### Sandbox Docker (`apps/server/src/tournament`)

Débito desde a Sprint 6: o contrato de container do torneio oficial (`docs/07-campeonato.md`) estava só documentado, sem implementação.

- `ContainerOrchestrator`: sobe a imagem do competidor numa rede Docker `--internal` (sem rota para a internet) com `--cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges`, injetando `AGENT_WS_URL`/`AGENT_NAME`/`AGENT_TOKEN` via env — sem publicar porta (o container disca para o orquestrador, nunca o contrário).
- `CommandRunner` injetável (`ExecCommandRunner` por padrão, envolve `child_process.execFile`) deixa a construção dos comandos Docker testável sem daemon real. 7 testes cobrem `runArgs`, `networkCreateArgs`, `ensureNetwork` (só cria rede se não existir), `start`/`stop`/`stop` tolerante a falha/`stopAll` paralelo.
- `apps/server/docker/sandbox-agent/`: imagem mínima de referência (`agent.mjs` + `Dockerfile` + `package.json`). Deliberadamente **não** depende de `@echo-front/protocol`/`@echo-front/agents-sdk` (não publicados no npm — débito reavaliado na Sprint 10) — só do pacote `ws`, implementando o protocolo do lado do cliente manualmente. Serve de esqueleto para qualquer competidor.

**Nota de verificação honesta:** este ambiente de sandbox de nuvem bloqueia pull do Docker Hub (`registry-1.docker.io` retorna 403 pelo proxy de rede), então `docker build`/`docker run` da imagem não puderam ser testados de ponta a ponta aqui. O que foi verificado de verdade: `docker network create --internal` funciona e cria rede isolada de fato (`Internal: true` confirmado via `docker network inspect`); os 7 testes do orquestrador passam contra um `CommandRunner` fake; e `agent.mjs` roda como processo Node puro (sem container) contra um `AgentServer` real, completando uma partida com hash de replay válido — ou seja, o protocolo do lado do cliente está correto. Falta só a camada de empacotamento Docker em si, documentada em `apps/server/docker/sandbox-agent/README.md` para verificação numa máquina com acesso normal ao Docker Hub.

### Comparação visual com a arte-conceito

Revisão de `ArenaView.tsx` (Pixi.js) contra `docs/assets/concept-01.png`: projeção isométrica, blocos de obstáculo extrudados com faces e arestas, unidades com formas por classe e halo de brilho, trilhas de movimento com seta direcional, cones de visão, HUD com feed de eventos e minimapa — a implementação já cobre de perto a arte original. Conclusão: sem gap visual relevante que justifique retrabalho agora; o esforço rendeu mais ao achar e corrigir o bug abaixo.

### Bug corrigido: replay demo desatualizado

Ao inspecionar `/replay/demo` para a comparação visual, apareceu "HASH DIVERGENTE ✗" — `demo.replay.jsonl` tinha sido gerado contra uma versão antiga do `@echo-front/sim` (antes dos campos de `mode`/`core_siege` das Sprints 8–9). Mesmo bug de padrão já visto antes: replay estático some de sincronia quando o sim muda e o replay não é regenerado.

Corrigido rodando `apps/web/scripts/gen-demo-replay.mjs series-3` contra o build atual — `demo gerado: seed=series-3 placar=1×3 vencedor=magenta hash=b76184aee149dd5d`. Confirmado via screenshot: "REPLAY VERIFICADO ✓" no ciclo 22/180.

### Landing page redesenhada (`apps/web/app/page.tsx`)

Antes: página isolada sem header/nav (diferente de `/matches` e `/leaderboard`), sem visual embutido, sem prévia de dados ao vivo, sem rodapé.

- Header com link "ECHO//FRONT" para home + nav (LEADERBOARD / PARTIDAS / COMPETIR), igual ao padrão já usado nas outras páginas.
- Hero mantido (copy, CTAs, pilares) — já estava sólido.
- Screenshot real do espectador embutido (`public/screenshots/hero-arena.png`, capturado do `/replay/demo` já corrigido), com legenda deixando claro que é captura real e não mockup.
- Nova seção "três modos, um protocolo" explicando Data Run / Core Siege / Silent Hunt.
- Prévia do topo da tabela do torneio amistoso (`fetchStandings()`, reaproveitando o `Panel` de `components/hud.tsx`), com link para o leaderboard completo.
- Rodapé com link do repositório.

## Verificação

- `pnpm --filter @echo-front/web build`: sucesso, `/` agora 9,59 kB / 121 kB first load.
- `pnpm -r test`: **120 testes**, todos verdes (protocol 17, sim 68, agents-sdk 14, server 21 — dos quais 19 são novos desta sprint: 7 de rate limiter, 5 de integração de rate limit, 7 do orquestrador de containers — mais os 2 e2e pré-existentes).
- Screenshots: landing completa (`/`) e `/replay/demo` (confirmando "REPLAY VERIFICADO ✓") capturados via Playwright contra o build de produção local.

## Débitos / Próximos

- Empacotamento Docker (`docker build`/`docker run`) do sandbox agent segue não verificado _neste ambiente_ por bloqueio de rede do Docker Hub — verificar numa máquina com acesso normal antes do primeiro torneio oficial.
- Herdados: publicação do `agents-sdk`/`protocol`/`sim` no npm; fog com envelhecimento de informação; playtest com leigos; matchmaking em fila e temporadas com ranking Elo persistente (a rotação atual é rodada manual via script).

## Retro

Os três itens pedidos pelo usuário ("infra de torneio", "visual/produto", "site/landing") acabaram se cruzando de um jeito não previsto: a investigação do item "visual" (comparar com a arte-conceito) não achou gap na arena em si, mas achou um bug real e visível no replay de demonstração — exatamente o tipo de coisa que só aparece quando alguém realmente olha a tela em vez de só ler o código. Vale manter esse hábito: qualquer sprint que toque em algo "visual" deveria sempre incluir abrir a página de verdade, não só confiar que os testes automatizados (que testam o hash, não a experiência de tela) bastam.
