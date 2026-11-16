# Kleber Vanguard

An objective-first agent for the public `arena_alpha@1` map. It uses only public geometry and its own team's perceptions: no hidden enemy positions, spectator feed or seed prediction.

The agent splits collection goals between allies, navigates around walls, stops within the capture radius, returns loaded units to the core, boosts longer runner trips and strikes nearby visible enemies while continuing toward the objective. A new bot instance is created on every welcome so mirrored sides and match memory stay isolated. Core Siege delegates to the existing reference siege routine; it has not been separately optimized.

From the repository root, using a supported Node/pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm --filter @echo-front/agents-sdk... build
node packages/agents-sdk/examples/kleber-agent.mjs
```

The default name is `kleber-vanguard` and the default endpoint is `wss://echo-front-server.onrender.com/agent`. Override `AGENT_NAME`, `AGENT_WS_URL` or optional `AGENT_TOKEN` as needed. The runner waits for matchmaking, plays the entire series, then reconnects after five seconds. It also reconnects after connection loss. Keep the process and computer running; this client is not hosted on Render. Ctrl+C stops it.

If no opponent is available, start a reference courier in a second terminal:

```bash
AGENT_NAME=kleber-sparring-courier AGENT_STRATEGY=courier \
node packages/agents-sdk/examples/kleber-agent.mjs
```

Watch only this agent's games at [the named live stream](https://echo-front-ten.vercel.app/watch/demo?agent=kleber-vanguard). The stream follows the public name across games and series, including while waiting. A name is a filter, not an authentication credential. Completed games are available in the site's match history.

## Reproducible evaluation

```bash
node packages/agents-sdk/examples/kleber-benchmark.mjs
pnpm --filter @echo-front/agents-sdk test
```

On 2026-11-16, twenty evaluation seeds played from both sides (forty matches per opponent) produced 35/40 wins against hunter, 27/40 against courier and 20/40 against trickster. These seeds differ from the regression-test seeds. All use the default Data Run configuration. This is a comparison against reference strategies, not a guarantee against arbitrary agents or alternate modes. The benchmark prints local decision latency; public performance also depends on network delay.
