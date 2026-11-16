# Kleber Vanguard

An objective-first agent for the public `arena_alpha@1` map. It uses only public geometry and its own team's perceptions: no hidden enemy positions, spectator feed or seed prediction.

The agent splits collection goals between allies, navigates around walls, stops within the capture radius, returns loaded units to the core, boosts longer runner trips and strikes nearby visible enemies while continuing toward the objective. A new bot instance is created on every welcome so mirrored sides and match memory stay isolated. Core Siege delegates to the existing reference siege routine; it has not been separately optimized.

## Run your own agent

Use Node.js 24 or 26 and the pnpm version pinned in the repository. For a new checkout:

```bash
git clone https://github.com/kleberandrade/echo-front.git
cd echo-front
pnpm install --frozen-lockfile
pnpm --filter @echo-front/agents-sdk... build
AGENT_NAME=my-vanguard node packages/agents-sdk/examples/kleber-agent.mjs
```

This uses workspace packages; no npm registry release is required. If you already have a checkout, start at the install/build commands.

The default name without `AGENT_NAME` is `kleber-vanguard` and the default endpoint is `wss://echo-front-server.onrender.com/agent`. Choose your own name (1–48 characters) to distinguish your games from other users running the example. Override `AGENT_WS_URL` or optional `AGENT_TOKEN` as needed. Guest play does not require a token. The runner waits for matchmaking, plays the entire series, then reconnects after five seconds. It also reconnects after connection loss. Keep the process and computer running; this client is not hosted on Render. Ctrl+C stops it.

If no opponent is available, start a reference courier in a second terminal:

```bash
AGENT_NAME=my-sparring-courier AGENT_STRATEGY=courier \
node packages/agents-sdk/examples/kleber-agent.mjs
```

Watch [my-vanguard's named live stream](https://echo-front-ten.vercel.app/watch/demo?agent=my-vanguard), replacing `my-vanguard` in the query if you choose a different name. The stream follows the public name across games and series, including while waiting. A name is a filter, not an authentication credential. Completed games are available in the site's [match history](https://echo-front-ten.vercel.app/matches). The free test server can take about a minute to wake after inactivity and uses temporary history storage.

## Use a local server

Start the project with `./scripts/start.sh` from the repository root. In separate terminals, run both agent commands above with `AGENT_WS_URL=ws://localhost:3001/agent` added before `node`. Watch `http://localhost:3000/watch/demo?agent=my-vanguard`. Use the public endpoint only when you intend to join the shared public queue.

## Customize the strategy

- [Runner](kleber-agent.mjs): connection, name/token, welcome handling, results, reconnection and shutdown.
- [Strategy](../src/vanguard-bot.ts): delivery priority, collection assignments, speed control and defensive strikes.
- [Navigation](../src/navigation.ts): routes based on public map geometry.
- [Benchmark](kleber-benchmark.mjs): mirrored comparisons against reference strategies.

Copy the runner for your own example and replace its `makeBot` factory with your own `(team) => decide` implementation. The SDK calls `decide(unitId, perception, cycle)` through the runner for each owned unit. Return a protocol decision synchronously within the 500 ms server cycle, including network time. Recreate team-dependent strategy state on each welcome, because sides can swap. Rebuild the SDK after changing TypeScript source. Keep the reference benchmark unchanged when comparing your own strategy against the published baseline.

The code is reusable under the project's [MIT license](../LICENSE). See the [agent protocol](../../../docs/04-protocolo-agente.md) for available perceptions and actions.

## Reproducible evaluation

```bash
node packages/agents-sdk/examples/kleber-benchmark.mjs
pnpm --filter @echo-front/agents-sdk test
```

On 2026-11-16, twenty evaluation seeds played from both sides (forty matches per opponent) produced 35/40 wins against hunter, 27/40 against courier and 20/40 against trickster. These seeds differ from the regression-test seeds. All use the default Data Run configuration. This is a comparison against reference strategies, not a guarantee against arbitrary agents or alternate modes. The benchmark prints local decision latency; public performance also depends on network delay.
