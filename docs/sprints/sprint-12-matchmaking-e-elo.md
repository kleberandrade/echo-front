# Sprint 12 — Matchmaking por Elo, Elo Persistente e `scripts/start.sh`

**Duração:** curta · **Meta:** quitar o débito "falta fila de matchmaking e um rating que persista entre execuções em vez de ser recalculado do zero a cada rodada" (herdado desde a Sprint 6/9), e dar um jeito rápido e confiável de subir o ambiente de dev local inteiro.

**Status: ✅ concluída em 2026-08-25.**

## Entregas

### Fila de matchmaking com pareamento por Elo (`apps/server`)

Antes, `AgentServer` guardava só **um** agente esperando por vez (`waiting: {ws, name} | null`): o próximo que chegasse pareava com ele, sempre — FIFO puro, sem noção de qualidade de partida.

- `waitingQueue` vira uma lista de verdade, e uma opção nova, `matchmakingWindowMs`, controla o comportamento:
  - **`0` (padrão — preserva o comportamento anterior)**: pareia assim que possível, igual antes.
  - **`> 0`**: acumula quem chega dentro da janela antes de decidir, e então casa os pares pelo **menor diff de Elo** disponível entre _todos_ os que estão esperando (não só o mais recente contra o mais antigo) — repete até sobrar 0 ou 1 na fila. Um agente sem par bom disponível continua esperando em vez de ser forçado numa partida desbalanceada.
- Elo vem de `MatchStore.standings()` (1000 se o agente ainda não jogou ou não há persistência).
- `queueLength()` novo em `AgentServer`, exposto em `GET /api/queue`.
- 3 testes novos (`agent-server.matchmaking.test.ts`): FIFO quando a janela é 0; pareamento por Elo mais próximo entre 3 candidatos quando a janela é > 0 (o mais antigo da fila fica de fora se não for o par mais equilibrado); remoção correta da fila ao desconectar mesmo quando não é o mais recente.

### Elo que persiste de verdade entre execuções

Investigando o débito, o código já fazia a coisa certa por baixo: `results.jsonl` é _append-only_, e `standings()` sempre recalcula a partir do arquivo inteiro — então rodar `tournament.ts` duas vezes com o mesmo `--data` **já acumulava** as partidas em vez de reiniciar do zero. O que faltava era: (1) deixar isso explícito e testado, e (2) um jeito de rotular uma rodada específica sem precisar trocar de `dataDir` inteiro nem perder o histórico anterior.

- `MatchResult` ganha `season?: string` (opcional, retrocompatível — resultados antigos sem o campo continuam contando em `standings()` sem filtro).
- `MatchStore.standings(season?)`: sem argumento, soma tudo (esse é o padrão que faz o Elo persistir entre execuções); com um rótulo, filtra só aquela temporada.
- `tournament.ts --season <rótulo>` e `AgentServer.configure({ season })` gravam o rótulo em cada resultado.
- `GET /api/leaderboard?season=<rótulo>` expõe o mesmo filtro pela API.
- 3 testes novos em `store.test.ts`, incluindo um que reabre o `MatchStore` num novo objeto (simulando um novo processo) apontando pro mesmo diretório e confirma que os dados persistiram.

### `scripts/start.sh`

Script único pra subir o ambiente de dev inteiro: valida `pnpm` (com fallback via `corepack enable`), roda `pnpm install` + `pnpm build` (necessário porque `packages/{protocol,sim,agents-sdk}` não têm modo watch — `apps/server`/`apps/web` importam o `dist/` compilado deles via `workspace:*`), configura `NEXT_PUBLIC_ECHO_API`/`NEXT_PUBLIC_ECHO_WS` apontando pro server local, e sobe `pnpm dev` (server `:3001`, web `:3000`). Flags `--skip-install`, `--skip-build` e `--fast` (= as duas) pra iterações rápidas. Testado de ponta a ponta neste ambiente: `--fast` subiu os dois serviços e ambos responderam (`/health` no server, `200` na home do web) em poucos segundos.

## Verificação

- `pnpm build`: sucesso, sem mudança de output relevante.
- `pnpm -r test`: **126 testes**, todos verdes (protocol 17, sim 68, agents-sdk 14, server 27 — dos quais 6 são novos desta sprint: 3 de matchmaking, 3 de persistência de standings).
- `./scripts/start.sh --fast`: server e web respondendo em `:3001`/`:3000` — testado e encerrado limpo.

## Débitos / Próximos

- **Docker sandbox** segue com a verificação de `docker build`/`docker run` pendente neste ambiente (Docker Hub bloqueado) — combinado com o usuário para ficar por último, depois dos demais débitos.
- Rating ainda é Elo simples (K=32), não Glicko-2 — funciona bem o suficiente pro tamanho atual do roster; Glicko-2 (que modela incerteza pra agentes novos/com poucas partidas) fica como possível upgrade futuro, não crítico agora.
- Herdados, ainda não tocados: publicação de `protocol`/`sim`/`agents-sdk` no npm; fog com envelhecimento de informação; playtest com pessoas de fora do projeto (esse último não é algo que dá pra resolver sozinho no código — precisa de gente de verdade jogando).

## Retro

O ponto mais valioso desta sprint não foi escrever código novo — foi descobrir, ao investigar o débito, que a persistência do Elo **já funcionava** (só não estava documentada nem testada como tal). Fica o registro pra próxima vez: antes de implementar a solução óbvia pra um débito antigo, vale conferir se o código já faz a coisa certa e o problema real é só falta de visibilidade/teste — evita trabalho redundante e ainda deixa um rastro de teste que prova a garantia pra sempre.
