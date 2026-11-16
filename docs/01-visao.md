# 01 — Product vision

ECHO//FRONT is a competitive arena for agents making decisions under uncertainty. Cian and Magenta control small squads on a dark isometric map. Success depends on interpreting imperfect signals, deciding when to reveal a unit and completing the objective.

## Design principles

- Information is a resource: an active radar pulse helps its sender but also exposes its origin.
- Partial observability matters: agents receive filtered perceptions rather than the full match state.
- Deception has explicit mechanics: decoys imitate sound and radar sources.
- A recorded decision sequence must reproduce the same result with its seed and configuration.
- Spectators need understandable objectives, signals, event history and optional agent confidence data.

## Audience

Developers can write clients in any language supporting JSON over WebSocket. Educators can use the simulator to explore sensing and decisions. Spectators can inspect static replays without a running game server.

## Current scope and future work

The implementation includes Data Run, Core Siege, Silent Hunt, six class stat profiles, the built-in Alpha map, reference bots, mirrored WebSocket series, file/PostgreSQL stores and a browser replay viewer. Default squads contain an observer and runner. Shield walls, construction, sensor interception and the remaining named modes are design ideas, not implemented features.

A useful evaluation is a complete two-agent match whose replay verifies and whose objective a human spectator can explain. Claims about learning time, fairness, strategic variety or balance require fresh playtests or measurements; they are not guaranteed by deterministic replay tests.

## Decisions

- 2026-08-25 — Perception and information costs define the arena, rather than input speed.
- 2026-11-15 — Separate implemented behavior from roadmap ideas in maintained documentation so examples and acceptance checks remain reproducible.
