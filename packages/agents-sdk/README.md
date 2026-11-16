# @echo-front/agents-sdk

TypeScript/Node client for ECHO//FRONT. `Agent` handles WebSocket handshake and per-unit perception callbacks. Reference bots include `wandererBot`, `hunterBot`, `courierBot`, `tricksterBot` and `ghostBot`; `vanguardBot` supplies the reusable competitive example and `siegeRoutine` supplies a Core Siege routine.

## Requirements and workspace setup

Use the Node/pnpm versions from the root manifests. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @echo-front/agents-sdk test
```

This workflow uses local workspace packages and does not assume a published npm release. The package exports compiled files from `dist/`.

## Executable examples

With the server running, launch the example agent in two terminals so the queue can pair them:

```bash
node packages/agents-sdk/examples/agent.mjs
```

Set `AGENT_WS_URL`, `AGENT_NAME` and optional `AGENT_TOKEN` to customize it. Alternatively, launch both reference bots at once:

```bash
pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots courier,trickster
```

The harness plays a complete series and prints results. It reconstructs team-dependent bots from each welcome because sides change between games.

For an objective-first strategy with public-server defaults, continuous reconnection and a named live stream, see [Kleber Vanguard](examples/kleber-agent.md). Its mirrored reference-bot benchmark is included and reproducible.

Check a local decision module without a server:

```bash
node packages/agents-sdk/dist/check.js packages/agents-sdk/examples/decide.mjs
```

The module exports synchronous `decide(unitId, perception, cycle)`. The checker runs 60 headless cycles against a reference bot, validates decisions against the protocol and verifies its replay. This is protocol conformance, not a strategy-strength benchmark.

## Client API

```js
import { Agent } from '@echo-front/agents-sdk';
const agent = new Agent({
  url: 'ws://localhost:3001/agent',
  agentName: 'minimal-agent',
  onPerception(_unitId, perception) {
    return { movement: { direction: perception.self.heading, speed: 0.5 } };
  },
});
await agent.connect();
// When shutting down: agent.close();
```

`connect()` resolves when the socket opens and sends hello, before pairing/welcome. `onWelcome`, `onMessage` and `onClose` expose lifecycle events. The perception callback is synchronous; keep it within the server cycle budget. Return `undefined` to send no decision. `sendDecision(unitId, cycle, payload)` is also available. The client currently ignores malformed incoming messages; it does not automatically reconnect or provide an async inference scheduler.

For headless perception-limited matches use `runPerceptionMatch` from `@echo-front/sim`. Reference bots receive `(unitId, perception, cycle)`; create separate bot instances per team/match to isolate state.

See the [protocol](../../docs/04-protocolo-agente.md), [root README](../../README.md), [Python client](../agents-sdk-py/README.md) and [Dart client](../agents-sdk-dart/README.md).

## License

MIT; see [LICENSE](LICENSE). Third-party dependencies retain their licenses.
