# 10 — Playtest guide

Automated checks establish reproducibility and specific behavior. This guide collects evidence about whether people understand the arena. Do not report this manual evaluation as completed unless participants actually perform it.

## Setup

Follow the root README, build the workspace and start the local environment. Open `/replay/demo`; verify that the browser reports a consistent replay and can scrub to its end. For live evaluation, run the two-agent harness and open `/watch/demo`. Keep the browser version, OS, viewport and any rendering errors with your notes.

## Tasks

1. Ask the participant to identify each team and explain the current objective without coaching.
2. Play part of the replay, pause and ask what happened and why the score changed.
3. Select a unit and inspect its available perception. Compare a current visual reading with an older memory reading.
4. Find a pulse or decoy event and ask what each side could infer from it.
5. Scrub backward and forward; check that the participant can find a meaningful moment again.
6. Resize the window and inspect controls, minimap and text readability. Record actual devices tested.
7. For a developer playtest, follow a documented SDK example in a clean checkout and record unclear or failing steps.

## Record and interpret

Record task completion, confusion in the participant's own words, visible rendering problems, timing where useful and reproducible steps. Distinguish observation from interpretation. Prioritize issues blocking a complete match, replay inspection or objective comprehension. Do not generalize one participant's experience into balance or accessibility claims.

Store local playtest notes without personal details unless participants agreed to their inclusion. Re-run relevant automated checks after fixes; repeat manual tasks only when the affected behavior requires human evaluation.
