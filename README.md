# ECHO//FRONT

[![CI](https://github.com/kleberandrade/echo-front/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kleberandrade/echo-front/actions/workflows/ci.yml)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 24 / 26](https://img.shields.io/badge/Node.js-24%20%2F%2026-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Dart 3.11+](https://img.shields.io/badge/Dart-3.11%2B-0175C2?logo=dart&logoColor=white)](https://dart.dev/)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A tactical 2.5D arena where AI agents compete through **perception**. Two teams interpret imperfect visual, thermal, sound and radar readings, transport data fragments and use decoys to mislead their opponents. The authoritative simulator, WebSocket server and PixiJS replay viewer share one deterministic simulation core.

Try the [live arena](https://echo-front-ten.vercel.app/watch/demo) with continuous reference agents. The test server runs on Render Free and can take about a minute to wake after inactivity.

## Requirements

- Node.js 24 LTS and the pnpm version pinned in `package.json`.
- Python 3.11+ for the optional Python SDK; Dart 3.11+ for the optional Dart SDK (see each SDK's manifest for the supported minimum).
- PostgreSQL for optional database integration tests; Docker for the optional tournament sandbox. Neither is required for the local file-backed server or static replay viewer.

## Installation and quick start

```bash
git clone https://github.com/kleberandrade/echo-front.git
cd echo-front
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
./scripts/start.sh --fast
```

Open `http://localhost:3000` for the arena and `http://localhost:3001/health` for server health. `start.sh` configures the browser to use the local API and spectator socket. Stop with Ctrl+C. Run `./scripts/start.sh` without `--fast` to install and build first. If Corepack is unavailable, install the exact pnpm version from `packageManager` using your Node package manager.

Shared packages resolve their compiled `dist/` files. Build before the first development run and rebuild after modifying `packages/`; these packages do not have watch tasks.

## Run agents and reproducible examples

In another terminal, with the server running:

```bash
pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots courier,trickster
```

Two agents join automatically and play a six-game series with mirrored sides. Each default game lasts up to 90 seconds. Open `/watch/demo` to watch the current match; `/matches` and `/leaderboard` show local server data when started with `start.sh`.

For a fast headless run that needs no server:

```bash
pnpm sim:run --seed quickstart --cycles 20 --bots random,idle --out /tmp/echo-front.replay.jsonl
pnpm sim:batch --n 4 --cycles 20 --botA courier --botB trickster --csv /tmp/echo-front.csv
```

CLI arguments follow the pnpm script name. See the [TypeScript SDK](packages/agents-sdk/README.md), [Python SDK](packages/agents-sdk-py/README.md) and [Dart SDK](packages/agents-sdk-dart/README.md) for agent examples. Use the local workspace; this quick start does not depend on registry publication.

## Workspace

- `apps/web`: Next.js App Router, React and PixiJS; arena, replays, leaderboard and match history.
- `apps/server`: NestJS REST API and persistent WebSocket gateways, matchmaking and storage.
- `packages/protocol`: canonical Zod schemas and TypeScript message types.
- `packages/sim`: deterministic simulation, seeded sensors, maps and replay tools.
- `packages/agents-sdk`: TypeScript WebSocket client, reference bots and headless checks.
- `packages/agents-sdk-py`, `packages/agents-sdk-dart`: optional clients for other languages.

## Configuration

`PORT` configures the server (default `3001`). `DATABASE_URL` enables PostgreSQL; otherwise the server stores agents, results and replays under `data/` relative to its working directory. Web variables `NEXT_PUBLIC_ECHO_API`, `NEXT_PUBLIC_ECHO_WS` and `NEXT_PUBLIC_SITE_URL` configure API, live viewing and public metadata. Browser variables are captured when Next.js builds. The free Render test blueprint in `render.yaml` enables continuous demo agents with `ECHO_DEMO_ENABLED=true`; it uses temporary storage. See [environment and deployment](docs/08-deploy.md) for exact behavior and persistence requirements.

## Validation

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @echo-front/web exec playwright install chromium
pnpm --filter @echo-front/web exec node scripts/smoke.mjs
```

Vitest covers protocol validation, deterministic simulation, golden replays, bots, storage and live WebSocket matches. The Playwright smoke runs the production web server, scrubs the demo replay and checks the rendered score and browser-computed hash. PostgreSQL tests run only when `TEST_DATABASE_URL` is supplied; a skipped test is not a database validation. Python and Dart have their own test commands in their SDK READMEs. CI runs the supported checks; see [deployment and CI](docs/08-deploy.md).

## Documentation and limitations

Start with the [documentation index](docs/README.md), [architecture](docs/03-arquitetura.md), [protocol](docs/04-protocolo-agente.md) and [simulation](docs/05-simulacao.md). Current operational guides are in English; [sprint notes](docs/sprints/README.md) remain a Portuguese historical archive.

Only `data_run`, `core_siege` and `silent_hunt` are implemented simulation modes. Other protocol enum values describe future work. The public spectator socket exposes the full match state. The default server accepts guest agents and its development seed schedule is predictable; it is not a hardened public tournament service. Decisions are collected on a 500 ms cycle, without a separate 350 ms deadline. See [competition](docs/07-campeonato.md) for operational limits and the optional container flow. Automated renderer tests do not establish playtest quality or competitive balance.

## License

[MIT](LICENSE), copyright Kleber Andrade. Package licenses preserve the same attribution. Third-party dependencies retain their own licenses.
