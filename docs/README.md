# ECHO//FRONT documentation

These English guides describe the implementation in this checkout. The canonical wire schemas are in `packages/protocol/src/index.ts`; simulation settings are in `packages/sim/src/types.ts`. Historical sprint acceptance claims do not replace current validation.

- [Product vision](01-visao.md): purpose, audience and design principles.
- [Game design](02-game-design.md): implemented resources, actions and modes.
- [Architecture](03-arquitetura.md): workspace boundaries and data flow.
- [Agent protocol](04-protocolo-agente.md): handshake, decisions and message validation.
- [Simulation and replays](05-simulacao.md): determinism, sensors and replay format.
- [Spectator and visual design](06-espectador-e-visual.md): arena and replay controls.
- [Competition](07-campeonato.md): matchmaking, scores and container execution.
- [Environment, deployment and CI](08-deploy.md): local variables, persistence and checks.
- [Playtest guide](10-guia-playtest.md): repeatable manual evaluation.
- [Maintenance log](maintenance-log.md): modernization actions and reasons.
- [Sprint archive](sprints/README.md): original Portuguese development history, including proposed features and unverified historical claims.

## Glossary

**Agent:** a WebSocket client controlling one team's units. **Unit:** an individual observer, runner or other configured class. **Cycle:** one perception/decision interval containing several simulation ticks. **Tick:** one deterministic movement step. **Fragment:** a Data Run objective transported to the friendly core. **Core:** a team's base, destructible in Core Siege. **Decoy:** a false sensor source. **Perception:** filtered information for one unit. **Replay:** seed, configuration, recorded decisions and expected final-state hash. **Series:** games between a pair of agents, with sides mirrored. **Season:** an optional result label used to filter standings.

## Conventions

Write maintained documentation in English. Keep code identifiers and protocol fields unchanged. Record meaningful design decisions with their date. Use reproducible examples and distinguish completed automated checks from manual checks, skipped tests and future plans.
