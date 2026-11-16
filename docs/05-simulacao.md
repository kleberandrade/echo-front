# 05 — Simulation and replay

## Deterministic boundary

`createMatch(seed, map, config)` creates match state. `stepCycle(state, decisions, map, config)` returns the next state and events; `buildPerceptions` derives filtered inputs for living units. `step` provides lower-level tick stepping. The simulation core has no network, file, wall-clock or unseeded random dependency. CLI programs own I/O and timing measurements.

Positions and movement use fixed-point integers scaled by 1000. The seeded PRNG is xoshiro128**, initialized through a deterministic hash/mixing function. Derived streams include subsystem, cycle and entity identifiers so unrelated sensor evaluations do not consume a shared random sequence. Unit ordering is stable. Golden replay tests pin the resulting state hash.

Default configuration contains five ticks per cycle and 180 cycles. The live server schedules 500 ms per cycle; headless simulation advances as fast as computation permits. Use `packages/sim/src/types.ts` for authoritative resource values, ranges, class stats and composition. See [game design](02-game-design.md) for implemented mechanics.

## Sensors and memory

Visual geometry uses range, cone and obstacle occlusion. Sound adds deterministic direction jitter and attenuation; thermal readings include residual heat trails. Radar quantizes positions and exposes pulse origins. `knownEnemies` stores last visible enemy positions in internal unit state. Agents receive only relative memory readings whose age increases and confidence decreases until expiry. Entries do not reveal a target's unseen movement.

## Replay format

`Replay` contains `header`, `cycles` and `finalHash`. `header` holds `sim`, `map`, `seed` and the complete `config`. Each cycle is `{ c, d }`, where `d` maps unit IDs to decisions. JSONL serialization writes one header line `{ "h": ... }`, one line per cycle, then `{ "end": { "finalHash": "..." } }`.

The actual format does not include the old design's protocol/team header or separate `dbg` record: `debug` remains inside each decision. `replayToJsonl` and `replayFromJsonl` own serialization. `resimulate` recreates initial state, checks map identity and cycle ordering, applies decisions and throws if the final hash diverges. Use the map corresponding to the replay; the default is Alpha.

```js
// Run from packages/sim after pnpm build:
import { runMatch, idleBot, resimulate } from './dist/index.js';
const result = runMatch({
  seed: 'documented-example',
  bots: { cian: idleBot(), magenta: idleBot() },
});
const verified = resimulate(result.replay);
console.log(verified.cycle, result.replay.finalHash);
```

For a file-producing executable, run from the repository root:

```bash
pnpm sim:run --seed replay-example --cycles 20 --bots random,idle --out /tmp/echo-front.replay.jsonl
```

The browser loader precomputes states for replay scrubbing and compares the final hash. Compatibility with older simulation versions is not guaranteed. If game rules intentionally change, inspect affected fixtures, update `SIM_VERSION` when appropriate and regenerate golden/demo data deliberately; do not silently accept mismatches.

## Tests and analysis

Vitest tests cover deterministic runs, random streams, actions, sensors, objectives, map validation, modes, thermal behavior and golden fixtures. The web smoke additionally checks browser/Node replay parity. A hash match verifies consistency with recorded decisions and configuration, not that those decisions came from a trusted player.

`pnpm sim:batch --n 4 --cycles 20 --botA courier --botB trickster --csv /tmp/echo-front.csv` runs perception-limited bots headlessly and alternates their sides. It is a development sample, not an official mirrored tournament: batch seeds vary between rows, whereas live series replay each seed on both sides. Keep sample size and configuration with any reported result.

## Decisions

- 2026-08-25 — Use fixed-point positions and seeded streams to make browser and server results reproducible.
- 2026-08-25 — Reconstruct replays from inputs instead of trusting snapshots.
