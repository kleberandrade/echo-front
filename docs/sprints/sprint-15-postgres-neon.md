# Sprint 15 — Persistência em Postgres (Neon)

**Duração:** curta (uma migração pontual, disparada pelo usuário) · **Meta:** trocar a persistência de `apps/server` (agentes, resultados, replays) de arquivos em disco pra Postgres, usando o Neon que o usuário acabou de adicionar na integração Vercel do `apps/web` — sem quebrar nada do que já funciona em disco.

**Status: ✅ concluída em 2026-08-26.**

## Contexto

Desde a sprint-06, `store.ts` documenta a `Store` como uma interface pensada de propósito pra essa troca: "interface pensada para trocar por Postgres/objeto sem tocar no resto". O gatilho chegou agora — o usuário adicionou o Neon na integração da Vercel ("adicionei o Neon no meu vercel") e escolheu, entre as opções apresentadas, migrar o `MatchStore` pro Postgres.

## O que mudou

- **`Store` (interface, `store.ts`)**: todos os métodos passaram a retornar `Promise` — contrato único pras duas implementações. `MatchStore` virou `FileMatchStore implements Store` (mesmo comportamento de antes, só que async por fora). `computeStandings()` foi extraída como função pura (Elo K=32, agregados por agente) — as duas implementações chamam a mesma função, então o cálculo de Elo/pontos nunca diverge entre disco e Postgres.
- **`PgMatchStore` (nova, `store-pg.ts`)**: implementa `Store` com `pg.Pool` puro (nenhuma API específica do Neon — funciona com qualquer Postgres). Schema (`agents`, `results`, `replays`) criado sob demanda via `CREATE TABLE IF NOT EXISTS` na primeira query, sem ferramenta de migração externa (schema pequeno demais pra justificar uma agora). `recordResult` grava resultado + replay numa transação (`BEGIN`/`COMMIT` num único client do pool, `ON CONFLICT (match_id) DO NOTHING` pra idempotência). Colunas `numeric` (pontos, energia gasta) voltam como `string` do driver `pg` — `rowToResult()` converte de volta pra `number` explicitamente.
- **`AgentServer.initStore()`**: lê `databaseUrl` (opção explícita) ou `process.env.DATABASE_URL`; se algum dos dois existir, usa `PgMatchStore`, senão cai no `FileMatchStore(dataDir)` de sempre. Zero mudança de código pra quem não configurar `DATABASE_URL` — o comportamento em disco é idêntico ao de antes da sprint.
- **Cache de Elo síncrono (o problema arquitetural real da migração)**: o matchmaking ao vivo (`onHello`/`tryPairAll`) não pode esperar um round-trip de Postgres só pra decidir com quem parear um agente que acabou de conectar. Solução: `AgentServer` mantém `eloCache: Map<string, number>`, recarregado via `refreshEloCache()` (na inicialização do store e depois de cada `recordResult`, via um callback `refreshElo` passado pra `Series`). `eloOf()` — chamada no hot path do pareamento — lê só do cache, síncrono, default 1000 pra agente desconhecido.
  - **Race condition encontrada e corrigida**: múltiplas chamadas de `refreshEloCache()` sobrepostas (uma disparada no construtor contra o store padrão, outra depois de `configure()` trocar o store) podem resolver fora de ordem — a mais lenta sobrescrevendo a mais recente com dados velhos. Corrigido com um contador de geração (`eloCacheGen`): cada chamada captura sua geração antes do `await`; se `eloCacheGen` mudou entre a captura e a resolução, o resultado é descartado. Documentado no código como defesa deliberada, não só um jeito de passar no teste — o mesmo cenário pode acontecer em produção com uma query lenta atravessando um `configure()` mais novo.
- **`recordResult` fora do caminho crítico**: chamado dentro de `match.onEnd`, não é mais `await`ado (era síncrono no `FileMatchStore` de antes) — `.then(() => this.refreshElo()).catch(err => console.error(...))`, o mesmo padrão fire-and-forget que já existia pro próximo jogo da série (`setTimeout`).
- **`api.controller.ts`/`tournament.ts`**: métodos que liam do store viraram `async`/ganharam `await` — Nest e o script de torneio já suportavam isso nativamente, sem mudança estrutural.

## Testes

- Suíte pré-existente (27 testes) adaptada pro contrato async — todos os `store.standings()`/`listResults()` etc. agora `await`ados, `fakeStore` dos testes de matchmaking também virou async.
- **`store-pg.test.ts`** (novo, 8 testes): `PgMatchStore` contra um Postgres de verdade, não mocks — idempotência de `registerAgent`/`recordResult`, `authenticate`, round-trip de replay, filtro de `season`, tipos `numeric` voltando como `number`, persistência entre instâncias reabrindo a mesma connection string.
- **`agent-server.pg.e2e.test.ts`** (novo): mesmo cenário de `agent-server.e2e.test.ts` (série de 2 partidas por WebSocket com bots reais), mas com `configure({ databaseUrl })` — prova o caminho de produção inteiro: matchmaking síncrono → partida real → `recordResult` no Postgres → `refreshEloCache` → `standings`/replay lidos de volta do banco.
- Ambos os arquivos de teste Postgres usam `describe.skipIf(!TEST_DATABASE_URL)` — pulados (não falham) sem a env var, então dev local sem Postgres instalado continua rodando o resto da suíte normal.
- **CI** (`.github/workflows/ci.yml`): job `ci` ganhou um serviço `postgres:16` e `TEST_DATABASE_URL`, então essa suíte roda de verdade lá, não só localmente.

### Bug real encontrado durante a verificação (não é flakiness de concorrência)

`agent-server.pg.e2e.test.ts` passava isolado mas falhava (0 resultados encontrados em vez de 2) quando rodado junto de outros arquivos de teste. A suspeita inicial era contenção de conexão no Postgres local compartilhado — descartada depois de reproduzir a falha mesmo com `--no-file-parallelism` e mesmo pareando o arquivo com um teste que nem toca em Postgres.

A causa real: `AgentServer` numera séries sequencialmente por instância (`s1`, `s2`, ...) — como o teste sempre cria uma instância nova, o `matchId` da primeira série é sempre `s1-g1`/`s1-g2`, **idêntico em toda execução**. Contra um Postgres de teste persistente (as tabelas não são recriadas a cada run), uma linha antiga com esse mesmo `matchId` de uma execução anterior fazia o `ON CONFLICT (match_id) DO NOTHING` do `recordResult` descartar silenciosamente o resultado novo — sem erro nenhum, só ausência dos dados (confirmado instrumentando `recordResult` com logs: `BEGIN`/`INSERT`/`COMMIT` completavam normalmente). Corrigido limpando os `matchId`s determinísticos do teste antes de cada execução. Não é um bug de produção — um processo real só cria `s1` uma vez na vida — mas deixaria a suíte flakey pra sempre contra um banco de teste compartilhado sem essa limpeza.

## Verificação

- `pnpm typecheck` / `pnpm build` / `pnpm test` (raiz, com `TEST_DATABASE_URL` setado) — verdes, monorepo inteiro.
- `pnpm --filter @echo-front/server test` isolado, 3 execuções consecutivas contra o mesmo Postgres — 36/36 estável (verificação extra depois do bug de `matchId` determinístico acima).

## Deploy — passo manual pendente do usuário

A integração Neon×Vercel injeta `DATABASE_URL` só no projeto `apps/web` (Vercel). `apps/server` roda em Railway/Fly/Render, separado — a env var precisa ser copiada manualmente pra lá. Documentado em `docs/08-deploy.md` § "Neon (Postgres gerenciado)". Sem esse passo, `apps/server` continua no `FileMatchStore` de disco, sem erro — só sem usar o Neon adicionado.

## Débitos / Próximos

- Nenhum débito técnico novo introduzido por esta sprint.
- Passo manual do usuário: copiar `DATABASE_URL` da Vercel (`apps/web`) pra plataforma que roda `apps/server`, e redeploy — ver `docs/08-deploy.md`.
- Migração de dados existentes (`data/results.jsonl` → Postgres) não foi feita — fora de escopo (o pedido era trocar a implementação daqui pra frente, não migrar histórico); se o usuário quiser preservar o histórico em disco ao trocar pra Postgres, é um script pontual de leitura do JSONL + `recordResult` em loop, não implementado nesta sprint.

## Retro

O trabalho de código em si (nova classe, testes, plumbing async) era mecânico — a interface já tinha sido desenhada pra isso desde a sprint-06. A parte que exigiu cuidado de verdade foi notar que o matchmaking ao vivo não podia virar assíncrono junto com o resto (cache + contador de geração), e depurar com disciplina em vez de assumir: quando a suíte ficou flakey só em conjunto, a hipótese óbvia era concorrência/contenção de conexão — só não bateu com o teste, e insistir nela sem confirmar teria levado a "corrigir" o sintoma errado (ex.: reduzir paralelismo do vitest) e deixar o bug real (matchId determinístico colidindo num banco de teste persistente) sem solução.
