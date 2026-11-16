# ECHO//FRONT — Agent instructions

A tactical 2.5D arena where AI agents compete through perception. Start with the [English documentation](docs/README.md).

## Stack and boundaries

Use the pnpm version pinned in `packageManager` and Node.js 24 LTS (`.nvmrc`), or another explicitly supported engine version. The monorepo uses pnpm workspaces and Turborepo, strict TypeScript with `noUncheckedIndexedAccess`, Next.js 16/PixiJS 8 in `apps/web`, and NestJS in `apps/server`.

- `packages/protocol` owns canonical Zod schemas and message types.
- `packages/sim` owns the pure deterministic domain. Keep clocks, network/file I/O and `Math.random` outside its core. Browser simulation is only for replay, never live match authority.
- `packages/agents-sdk` owns the TypeScript client, reference bots and executable examples.
- Python and Dart clients have their own manifests, test tools and examples.
- The authoritative server owns scheduling, sockets and storage; the web owns rendering and replay controls.

## Conventions

Maintain documentation in English. Original Portuguese sprint notes are a historical archive, not the current contract. Preserve protocol identifiers such as `pulse_scan` and `carrying_fragment`.

Use single quotes, semicolons, trailing commas and Prettier's configured print width. Validate untrusted data where it enters; keep domain rules independently testable. Write relevant behavior tests for protocol/simulation changes and keep golden replay changes deliberate. A completed change needs a reproducible example or check. Record significant design decisions with their date in the appropriate document.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm test:smoke
./scripts/start.sh --fast
pnpm sim:run --seed example --cycles 20 --bots random,idle --out /tmp/echo-front.replay.jsonl
```

Build shared packages before development; their exports resolve `dist/` and they have no watch tasks. Browser smoke requires Playwright Chromium. PostgreSQL tests require a disposable `TEST_DATABASE_URL`; skipped tests are not validation. See SDK READMEs for Python/Dart checks.

## Commits

Use Conventional Commits with scopes such as `web`, `server`, `sim`, `protocol`, `agents-sdk`, `docs`, `ci` and `repo`. Explain the reason, change and validation. Husky formats staged files and validates commit messages. Follow the user's explicit authorization for remote operations; local commits do not authorize push, publication or deployment.

## Specialized delegation

Delegate specialized work where useful: simulation/determinism, protocol/schema compatibility, frontend/replay rendering, server/WebSocket/storage and read-only review. Keep file ownership clear and preserve other agents' changes.
