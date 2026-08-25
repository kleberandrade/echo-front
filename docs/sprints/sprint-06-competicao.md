# Sprint 6 — Competição

**Duração:** 2 semanas · **Meta:** abrir para o mundo: agentes externos jogam partidas públicas, leaderboard no site, documentação de competidor completa. **Marco M4 — ✅ primeiro torneio amistoso concluído.**

**Status: ✅ concluída em 2026-08-25.**

## Objetivos

1. Infra de partidas públicas com autenticação de agentes.
2. Leaderboard e páginas de partida/replay públicas.
3. Experiência de onboarding do competidor ([07-campeonato.md](../07-campeonato.md)).

## Backlog

### Server
- [x] Registro de agentes: `POST /api/agents { name }` → token; `hello` com token usa a identidade registrada (sem token joga como convidado).
- [x] Matchmaking FIFO → **série ranqueada de 6 partidas com lados espelhados** (3 sementes, cada uma jogada 2× trocando cian/magenta); protocolo 0.2.0 adiciona `series {seriesId, game, of}` opcional ao welcome.
- [x] Persistência: `MatchStore` em disco (agents.json, results.jsonl, replays/) com interface pronta para trocar por Postgres + object storage — decisão registrada abaixo.
- [x] API REST pública: `GET /api/leaderboard`, `GET /api/matches`, `GET /api/matches/:id/replay` (JSONL com `finalHash`).
- [x] Pontuação do regulamento por partida (`scoreMatch`): vitória 3 · empate 1 · +0,5/fragmento (máx 1,5) · +0,1/unidade viva · +0,2 eficiência energética.

### Web
- [x] `/leaderboard`: ranking com pontos, V/E/D, fragmentos e a métrica de mérito "vitórias sem abate"; consome a API quando `NEXT_PUBLIC_ECHO_API` está definida, senão os JSONs estáticos do torneio (site funciona sem server).
- [x] `/matches`: histórico com link "assistir" — cada replay do torneio abre no viewer e **re-valida o hash no browser**.
- [x] `/compete`: guia do competidor — ciclo percepção→decisão, exemplo TS (SDK) e Python (protocolo cru), conformidade, séries, pontuação e tabela de sensores (cobre o débito da página de protocolo da Sprint 4).
- [ ] Delay anti-coaching na transmissão ao vivo — adiado (débito).

### Comunidade e evento
- [x] Teste de conformidade self-service: `pnpm --filter @echo-front/agents-sdk agent:check -- ./agente.mjs` valida `decide()` contra o schema em partida headless.
- [x] Harness atualizado joga a série completa (lê `series.of` do welcome e reancora o time a cada partida).
- [x] **Torneio amistoso**: round-robin de 4 agentes (courier, trickster, ghost, hunter) via WebSocket real — **36 partidas, zero divergência de replay**, em ~100 s acelerado (`pnpm --filter @echo-front/server tournament`). Resultado: 1º trickster 79,4 pts · 2º ghost 53,7 · 3º courier 48,3 · 4º hunter 6,0.
- [ ] Publicação do `agents-sdk` no npm e repo template — adiado (exige conta npm).

## Critérios de aceite

1. ✅ Um dev externo, só com o site (`/compete`), conecta um agente e disputa uma série ranqueada em < 1 h: registro por API, exemplo mínimo em 2 linguagens, verificador de conformidade e matchmaking automático.
2. ✅ Leaderboard reflete resultados automaticamente (standings derivados do store); todo resultado tem replay verificável por re-simulação (hash validado inclusive no browser).
3. ✅ Torneio amistoso com 36 partidas válidas (≥12) e **zero divergência** de replay.

## Decisões

- 2026-08-25 — Persistência em arquivos (JSON/JSONL) atrás da interface `MatchStore`: elimina a dependência de Postgres no MVP e roda em qualquer host; a troca por banco fica isolada numa classe.
- 2026-08-25 — Protocolo 0.2.0 (minor, aditivo): campo opcional `series` no welcome; agentes 0.1.x seguem compatíveis.

## Débitos / Retro

- **Débito:** rate limiting real e sandbox de containers (torneio oficial) — próximo ciclo, conforme o roadmap do doc 07.
- **Débito — ✅ parcialmente quitado na Sprint 7:** delay anti-coaching implementado (`spectateDelayMs` no AgentServer) e kick por payloads inválidos (3 avisos / 10 desconexão, conforme o doc 04). Pendente: publicação npm + template.
- **Débito:** o 4º colocado (hunter) não joga o objetivo — útil como sparring, mas o roster ranqueado deveria exigir bots de objetivo.
- **Retro:** o determinismo pagou de novo: o torneio inteiro (36 partidas ao vivo por WS) re-simulou sem 1 byte de divergência — o critério mais arriscado da sprint passou sem ajustes.
