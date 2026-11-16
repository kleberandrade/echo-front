# 02 — Game design

## Implemented game loop

Each team controls the classes in `DEFAULT_CONFIG.composition` (an observer and runner by default). Every decision cycle contains five deterministic movement ticks. The live server schedules one cycle every 500 ms; the default 180-cycle game lasts at most about 90 seconds, excluding setup and series pauses. Headless runs advance without a real-time clock.

Movement uses a direction in degrees (0 east, counterclockwise) and speed from 0 to 1. The server validates message shape; the simulator resolves energy, cooldowns, geometry and objective conditions. Missing decisions preserve previous movement and trigger no new action. Obstacles block movement and line of sight.

## Resources and actions

Units have class-specific integrity, maximum energy, speed and sensor properties. Energy regenerates by 2 per cycle; towers add 4. Fast movement costs energy. Exhaustion limits speed. Integrity does not automatically regenerate.

- `pulse_scan`: radar snapshot within radius 18; costs 25 energy (observer: 15), with a five-cycle cooldown. Reveals the pulse origin to others.
- `deploy_decoy`: costs 20 energy and creates a false sound/radar source lasting ten cycles.
- `hide`: costs 10 energy and lasts three cycles, suppressing visual visibility and movement.
- `speed_boost`: costs 3 energy per cycle, increases speed by a factor of 1.6 and increases noise.
- `strike`: costs 15 energy, deals 20 damage at range 3 and creates noise.
- `pickup` and `drop`: interact with fragments; objective range and capture rules still apply.

These values are defaults in `packages/sim/src/types.ts`, not duplicated configuration knobs in the server. Tests pin interactions and edge cases. Classes `observer`, `runner`, `warden`, `phantom`, `disruptor` and `architect` have stat profiles; names do not imply implemented shield, jamming or construction powers.

## Sensors

Visual readings provide type, direction, distance and confidence within the unit's cone and unobstructed range (observer: 120°/18; runner: 90°/14). Sound travels farther with direction jitter and obstacle attenuation. Thermal sensing reports intensity and direction from units, residual heat and towers. Active radar reports quantized positions and pulse origins. Memory reports a previously seen target's last known location, relative to the observer's current position; its confidence decays and the entry expires after the configured memory interval (default 12 cycles).

Team messages arrive on the next cycle when communication permits. Interference can suppress messages and return stale ally snapshots marked `stale: true`. Sensor absence does not prove that no enemy is nearby.

## Modes and objectives

**Data Run:** capture fragments and return them to the friendly core. Capture requires two consecutive eligible cycles within radius 2; enemy proximity can block capture. Carriers move at 80% speed and emit more sound. The first team to deliver three fragments wins; otherwise `decideWinner` resolves the time-limit result using score, carried fragments, surviving integrity and energy efficiency.

**Core Siege:** find and destroy the enemy core. Core integrity defaults to 100; strikes deal 20 core damage. Enemy core perception is range-limited.

**Silent Hunt:** Data Run with a configured per-unit radar pulse budget. Tournament configuration sets this to two. Setting `maxPulsesPerMatch: 0` means unlimited; selecting the mode alone does not set a nonzero budget.

`signal_control`, `energy_crisis`, `mutation` and `escort` appear in the protocol enum but have no simulation implementation. They must not be advertised as playable modes.

## Arena and balance

The built-in Alpha map defines obstacles, spawn points, towers and interference zones. Map validation checks structural constraints. Bot batch runs provide reproducible observations, not proof of competitive balance. Preserve seeds, configuration, bot code and outputs when comparing strategies.
