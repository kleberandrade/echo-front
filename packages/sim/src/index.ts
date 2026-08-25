/**
 * ECHO//FRONT — núcleo determinístico da simulação.
 *
 * Regras invioláveis (docs/05-simulacao.md):
 * - `step` é pura: sem I/O, sem Date, sem Math.random;
 * - todo ruído vem do PRNG serializável do estado;
 * - posições em fixed-point (×1000) para reprodutibilidade Node/browser.
 */
export { SCALE, dist2, fromFixed, moveFixed, toFixed, type Fixed } from './fixed.js';
export { deriveStream, nextFloat, nextInt, nextU32, seedRng, type RngState } from './rng.js';
export {
  ARENA_ALPHA,
  isBlockedCell,
  isBlockedFixed,
  towerAt,
  validateMap,
  type MapDef,
  type MapValidation,
  type Rect,
} from './map.js';
export {
  DEFAULT_CONFIG,
  type ClassStats,
  type ActionsConfig,
  type Decoy,
  type DecisionsByUnit,
  type Fragment,
  type FragmentsConfig,
  type FragmentState,
  type GameMode,
  type MatchConfig,
  type MatchState,
  type Noise,
  type QueuedMessage,
  type RadarPulse,
  type SensorConfig,
  type TickResult,
  type Unit,
} from './types.js';
export { canonicalJson, stateHash } from './hash.js';
export {
  SIM_VERSION,
  createMatch,
  decideWinner,
  inInterference,
  step,
  stepCycle,
} from './step.js';
export {
  angleDiff,
  directionDeg,
  distanceUnits,
  hasLineOfSight,
  inVisionCone,
  obstaclesCrossed,
} from './geometry.js';
export { buildPerception, buildPerceptions } from './sensors.js';
export {
  idleBot,
  randomBot,
  runPerceptionMatch,
  type PerceptionBotFn,
  replayFromJsonl,
  replayToJsonl,
  resimulate,
  runMatch,
  type BotFn,
  type Replay,
  type ReplayCycleRecord,
  type ReplayHeader,
  type RunResult,
} from './match.js';
