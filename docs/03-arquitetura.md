# 03 — Architecture

## Boundaries

The pnpm/Turborepo workspace separates the deterministic domain from transport, persistence and rendering. `packages/protocol` defines Zod schemas. `packages/sim` imports those types and owns game state and rules. `packages/agents-sdk` uses both for clients, examples and conformance checks. `apps/server` hosts the authoritative simulation; `apps/web` uses the same simulator only to reconstruct replays.

The simulation core must remain independent of sockets, storage, wall-clock time and unseeded randomness. Node-only CLI and replay I/O entry points surround that core. The web application imports workspace packages through compiled `dist/` exports, so shared packages must be built before web development.

## Live match flow

1. A client connects to `/agent`, sends `hello` and enters the waiting queue.
2. `AgentServer` pairs clients, starts a mirrored series and sends `welcome`, `match_start` and per-unit perceptions.
3. Clients send decisions. The server verifies ownership and accumulates the current cycle's input.
4. At the cycle interval, the server advances the pure simulation and emits the next perceptions and spectator state.
5. Completed games persist results and JSONL replays. The series swaps sides and starts its next game.

`AgentGateway` and `SpectatorGateway` adapt NestJS sockets to `AgentServer`. The server owns the clock; the simulator never decides when real time has passed. The current default cycle is 500 ms, with five simulation ticks per cycle. A separate 350 ms decision deadline is not implemented.

## Storage and API

A common `Store` interface supports `FileMatchStore` and `PgMatchStore`. Without `DATABASE_URL`, files live under `data/` relative to process cwd. PostgreSQL is selected at initialization when a database URL is available; tables are created lazily. Store implementations provide registration, result history, replay lookup and standings.

REST routes: `GET /health`, `GET /api/leaderboard` (optional `season`), `GET /api/matches`, `GET /api/queue`, `GET /api/matches/:id/replay` and `POST /api/agents` with `{ "name": "my-agent" }`. Registration returns a token; guest play remains allowed.

## Web and replay flow

The implemented routes are `/`, `/compete`, `/matches`, `/leaderboard`, `/watch/demo` and `/replay/[id]`. React owns controls and PixiJS draws the arena. There is no Zustand dependency or generic `/watch/[matchId]` route.

With `NEXT_PUBLIC_ECHO_API` set, match history and standings use the server; otherwise they use committed JSON under `public/data`. Replays are fetched as JSONL and reconstructed with `packages/sim` in the browser. The replay loader precomputes cycle states for scrubbing and compares the final-state hash. This is consistency checking, not cryptographic proof of origin.

## Deployment boundary

Vercel can host `apps/web` and its static replays. The authoritative server requires a persistent Node process supporting WebSocket, plus durable file storage or PostgreSQL. An isolated tournament places server and agent containers on the same internal Docker network. See [deployment](08-deploy.md) and [competition](07-campeonato.md).

## Decisions

- 2026-08-25 — Keep live match authority on the server; browser simulation is for replay only.
- 2026-08-25 — Store seed and decisions instead of full snapshots to make replay reproducible.
- 2026-08-25 — Keep the persistent WebSocket server outside the web's serverless hosting boundary.
