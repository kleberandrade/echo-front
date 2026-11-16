# @echo-front/sim

Deterministic ECHO//FRONT simulation: fixed-point movement, seeded sensors, energy, actions, fragment objectives, Core Siege, Silent Hunt and enemy memory. The same core runs on the authoritative Node server and in the browser replay viewer. CLI entry points add Node I/O around the pure core.

## Workspace setup and use

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @echo-front/sim test
pnpm sim:run --seed example --cycles 20 --bots random,idle --out /tmp/echo-front.replay.jsonl
```

The local workspace does not require a published npm version. Main exports include `createMatch`, `step`, `stepCycle`, `buildPerceptions`, `DEFAULT_CONFIG`, `ARENA_ALPHA`, `runMatch`, `runPerceptionMatch`, `resimulate`, `replayToJsonl`, `replayFromJsonl` and `stateHash`.

For example, run this module from the package directory after building:

```js
import { idleBot, runMatch, resimulate } from './dist/index.js';
const result = runMatch({
  seed: 'example',
  bots: { cian: idleBot(), magenta: idleBot() },
});
console.log(resimulate(result.replay).cycle, result.replay.finalHash);
```

`runMatch` bots receive full state and are appropriate for low-level fixtures. `runPerceptionMatch` limits bots to filtered per-unit perceptions, matching the information boundary of remote agents. Recreate bot instances between matches when they hold state.

## Validation and limitations

Tests cover determinism, golden replays, maps, actions, modes, sensors, heat and objectives. Identical seed/configuration/map/decisions reproduce the same result under compatible simulation code. A replay hash is a consistency check, not cryptographic authentication. Older replay compatibility is not guaranteed across rule changes. Only `data_run`, `core_siege` and `silent_hunt` are implemented modes.

See [simulation and replay](../../docs/05-simulacao.md) and [game design](../../docs/02-game-design.md).

## License

MIT; see [LICENSE](LICENSE).
