# Maintenance log

## 2026-11-15 — Supported toolchain and reproducible workflows

This log records actions and reasons for the modernization. It distinguishes locally completed checks from CI configuration and environment limits. Historical sprint notes remain unchanged apart from their archive notice.

- Inspected repository instructions, manifests, existing tests, architecture and transport/storage code before editing. Preserved the tactical arena and workspace boundaries.
- Updated the supported Node/pnpm/TypeScript, Next.js/React and Vitest toolchain and Zod 4.6.7; validated existing protocol and golden fixtures after the security-driven Zod migration. Node.js 24 LTS is the local default; Node.js 26 is also supported by engines and CI.
- Added behavioral regressions at external boundaries, including replay map/order validation, CLI numeric bounds and live decision cycle handling. Kept existing golden replay behavior rather than rewriting the simulator.
- Added executable TypeScript examples and native SDK examples so setup does not depend on registry publication. Modernized Python/Dart client dependencies and their test workflows.
- Configured CI for Node.js 24/26, a separate disposable PostgreSQL 17 integration job with serialized database files, Chromium replay smoke, Python 3.11/3.13 and Dart 3.11.5.
- Rewrote maintained documentation in English after checking code against earlier design claims. Corrected protocol version, replay format, implemented modes, map availability, string limits, timing, guest authentication and seed/spectator trust limits. Marked original Portuguese sprint notes as historical.
- Added a dynamic GitHub Actions badge and descriptive language/runtime/framework/license badges. A badge's remote status is independent of local validation.
- Checked local documentation links and formatted maintained Markdown with Prettier. Ran documented Node examples directly against built workspace packages: the 20-cycle simulator, four-game bot batch, 60-cycle agent conformance check (120 decisions), idle replay resimulation and protocol hello parsing all completed.

## Validation evidence and limits

The Node.js 24 baseline build and TypeScript tests completed before changes (126 tests passed, nine PostgreSQL tests skipped). The modernized TypeScript suite subsequently completed with 143 passing tests and nine PostgreSQL tests skipped in the local environment. The skips require a disposable `TEST_DATABASE_URL`; CI explicitly supplies one in its database job.

Local Docker daemon access was unavailable for a container tournament, so container command tests and Node/WebSocket integration checks must not be reported as a completed Docker run. The production Chromium smoke completed and verified both the rendered final score and browser replay hash. The available dryer analysis found no duplication in the replay module. Replay coverage measured 100% of 16 lines, with CRAP scores 4/3/2, and all 11 selected replay mutations killed after adding the inclusive event-boundary assertion. Python SDK validation: 16 tests passed, 99% line coverage, maximum CRAP 8, no duplicate candidates at 0.8, and all 29 selected mutations killed. Dart SDK: eight tests passed, analyzer/format checks clean; quality tools do not support Dart. Server guard mutation checks killed six of seven selected sites; the survivor changes only a return value ignored by the gateway, so it is behavior-equivalent at the tested boundary. Server complexity was measured without coverage; no CRAP score is claimed for it. Quality-tool runs with incorrect project roots were discarded rather than reported as test strength.

The production dependency audit initially reported 13 advisories. Updated compatible dependencies and migrated Zod to 4.6.7; `pnpm audit --prod` then reported no known vulnerabilities. This is a point-in-time registry audit, not a security certification. Explicitly forwarded development environment variables through Turborepo and included public build settings in cache keys. Updated GitHub About through the authenticated API without exposing credentials. Publication is authorized after final validation; remote workflow results are reported separately. No human playtest, physical-device test or competitive-balance study is claimed.

## Final local checks and commit sequence

- Node.js 24: typecheck, production build, 143 behavioral tests (nine database skips), Chromium smoke, example conformance and production dependency audit passed after dependency installation completed. An earlier build overlapped installation and saw transient missing modules; the subsequent stable build and smoke both passed.
- Node.js 26: forced an uncached run; all 143 TypeScript tests passed with the same nine database skips.
- Checked shell syntax/help, local documentation links, changed-file formatting and Git whitespace. All seven README badge image URLs returned HTTP 200. MIT notices and original authorship were retained.
- Local commits: `e187001` server lifecycle; `456b4b1` browser replay verification; `3fa0462` native SDK boundaries/examples; `fe0a8a9` CLI/environment; `35e20b6` supported toolchain; `b2ca87e` native/database CI. This documentation and the badges form the next commit. Commit hooks formatted staged files and validated Conventional Commit messages.
- The user subsequently authorized publishing the full modernization to `main` after passing tests. Verified `origin` points to `kleberandrade/echo-front`, the default branch is `main`, and authenticated access permits push. No force push, deployment or package publication is included. The final report records the pushed commit and remote CI outcome.
