# Sprint 6 — Competição

**Duração:** 2 semanas · **Meta:** abrir para o mundo: agentes externos jogam partidas públicas, leaderboard no site, documentação de competidor completa. **Marco M4 — primeiro torneio amistoso.**

## Objetivos

1. Infra de partidas públicas com autenticação de agentes.
2. Leaderboard e páginas de partida/replay públicas.
3. Experiência de onboarding do competidor ([07-campeonato.md](../07-campeonato.md)).

## Backlog

### Server
- [ ] Registro de agentes: token por agente, nome/tag de equipe, rate limiting.
- [ ] Fila de matchmaking simples (pareamento por ordem de chegada; séries de 6 partidas com lados espelhados).
- [ ] Persistência: partidas, resultados e replays em Postgres + storage de objetos (replays JSONL).
- [ ] API REST pública: listar partidas, baixar replay, resultado com `finalHash`.
- [ ] Pontuação da série conforme regulamento (vitória/empate/bônus) calculada e armazenada.

### Web
- [ ] `/leaderboard`: ranking por pontos, filtros por temporada/desafio; métricas de mérito (precisão de inferência, decoys comprados).
- [ ] `/matches`: histórico com link para replay de cada partida.
- [ ] `/compete`: guia do competidor — protocolo, quickstart do SDK, exemplo mínimo em Python (sem SDK) e TS (com SDK), regras do amistoso.
- [ ] Delay opcional de transmissão em partidas ao vivo (anti-coaching): espectador atrasado 30 s.

### Comunidade e evento
- [ ] Empacotar `agents-sdk` (npm) e template de agente (repo template no GitHub).
- [ ] Teste de conformidade self-service: `pnpm agent:check` valida um agente contra partidas de fixture.
- [ ] Organizar torneio amistoso interno (≥ 4 agentes, sendo ≥ 1 externo ao time), com replays publicados.
- [ ] Regulamento v1 publicado em `/compete/rules`.

## Critérios de aceite

1. Um dev externo, só com o site, conecta um agente e disputa uma série ranqueada em < 1 hora.
2. Leaderboard reflete resultados automaticamente; todo resultado tem replay verificável por re-simulação.
3. Torneio amistoso concluído com pelo menos 12 partidas válidas e zero divergência de replay.

## Fora de escopo

Containers Docker de torneio oficial, temporadas com Elo, perfis ricos — próximo ciclo de planejamento.

## Débitos / Retro

_(preencher ao fim da sprint)_
