# 06 — Spectator and visual design

## Visual language

The PixiJS arena uses a dark isometric circuit-board style. Cian and Magenta identify teams; amber highlights objectives. Geometric units, luminous paths, pulse rings and sensor overlays make otherwise invisible information costs inspectable. React controls sit outside the renderer.

The main components are `ArenaView`, `ReplayViewer`, `LiveViewer`, `Minimap` and the HUD under `apps/web/components`. The viewer supports unit inspection, sensor/fog overlays, event history and agent debug information where recorded. Do not interpret an agent-provided confidence value as a calibrated probability.

## Replay workflow

Open `/replay/demo` or a replay linked from `/matches`. The browser fetches the replay JSONL, simulates cycle states locally, checks the final hash and lets the user play or scrub through the result. It needs the web application and replay file, not a live game server. A verification failure must be investigated as a format/configuration/rule mismatch rather than hidden.

## Live workflow

Set `NEXT_PUBLIC_ECHO_WS=ws://localhost:3001/spectate` for local development (the startup script sets it), run two agents and open `/watch/demo`. Live viewing follows the latest match. A connection opened while idle may need a refresh after a match starts. The spectator feed is omniscient and should be delayed or access-controlled for real competitions.

## Validation

The production Playwright smoke launches Next.js, opens the demo, scrubs to the end, checks the rendered score and compares the replay hash reconstructed in Chromium. Screenshots are diagnostic artifacts. This check does not establish usability, human comprehension, GPU portability or mobile ergonomics; use the [playtest guide](10-guia-playtest.md) for manual evaluation.
