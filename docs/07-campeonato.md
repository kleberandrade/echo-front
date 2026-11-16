# 07 — Competition and sandbox

## Local competition

The server pairs agents entering `/agent` and runs six games by default. Each seed is played twice with sides swapped. `welcome.payload.team` is authoritative for every game. The TypeScript harness creates fresh team-dependent bots after each welcome:

```bash
pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots courier,trickster
```

The queue pairs arrivals immediately by default. A positive `matchmakingWindowMs` configured through `AgentServer.configure()` accumulates candidates and selects the closest Elo pair. `GET /api/queue` reports waiting clients. These internal options are not automatically environment variables.

## Results, scores and seasons

`scoreMatch` awards 3 points for a win, 1 for a draw, up to 1.5 for fragment deliveries (0.5 each), 0.1 per surviving unit and 0.2 for lower energy consumption when unequal. Standings include simple Elo (K=32) and are rebuilt from persisted history. A `season` label filters standings without deleting or physically separating old results. `GET /api/leaderboard?season=example` applies the filter.

Run a small accelerated round-robin without overwriting committed public data:

```bash
pnpm --filter @echo-front/server tournament -- --games 2 --cycleMs 5 --modes data_run --data /tmp/echo-front-tournament-data --out /tmp/echo-front-tournament-public --season local-example
```

This creates its own WebSocket listener, plays reference bots, checks stored replays and exports static data/replay files. Reusing the data directory accumulates history. Use fresh directories for isolated comparisons. The exporter currently copies replay files from file storage, so use its file-backed mode rather than `DATABASE_URL` for this workflow. Do not set an extremely short interval for agents requiring expensive computation.

## Container contract

An agent image runs a process that connects outward to `AGENT_WS_URL`. `AGENT_NAME` and optional `AGENT_TOKEN` identify it. The reference orchestrator supplies 1 CPU, 512 MB memory, 128 PIDs, dropped capabilities and `no-new-privileges`, and attaches the container to an internal Docker network.

The authoritative server must also run as a container on that network. Agent URLs use `ws://echo-front-orchestrator:3001/agent`, not `host.docker.internal`; host connectivity is not guaranteed inside an internal network.

```bash
./scripts/run-tournament-sandbox.sh
```

This requires a working Docker daemon and registry access for builds. It creates/reuses `echo-front-tournament`, builds two images, publishes server port 3001 for observation and runs two example agents. It waits up to 110 seconds for one completed game. It removes its named containers on success and leaves diagnostics on failure. Stop any local process already using port 3001 first. The script removes existing containers with its fixed names; do not reuse those names for unrelated work. See the [sandbox example](../apps/server/docker/sandbox-agent/README.md).

## Operational limitations

The development server permits guest names; registration tokens identify a stored name but do not form a mandatory authentication policy. Default seed scheduling is predictable. Spectator state is omniscient, with zero delay by default; `spectateDelayMs` is a code configuration option. IP limits constrain connection rates and concurrency, not arbitrary resource consumption by already connected clients. Docker resource flags and an internal network are useful controls, but not a complete hostile-code isolation boundary.

There is no separate 350 ms decision cutoff. Clients should respond within the configured cycle and echo the current cycle number. Missing input keeps previous movement and causes no new action. Replays verify deterministic consistency, not the trustworthiness of a participant or result publisher.

Group stages, double-elimination playoffs, inference-quality scoring and Glicko-2 remain organizational/design proposals. Automated command-construction tests do not establish that Docker builds or a complete container tournament ran on a particular host; report actual validation separately.
