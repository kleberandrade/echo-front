/**
 * Execução de partidas headless + replay (semente + decisões = partida).
 */
import type { DecisionPayload, PerceptionPayload } from '@echo-front/protocol';
import { stateHash } from './hash.js';
import { ARENA_ALPHA, type MapDef } from './map.js';
import { deriveStream, nextInt, type RngState } from './rng.js';
import { buildPerceptions } from './sensors.js';
import { createMatch, SIM_VERSION, stepCycle } from './step.js';
import {
  DEFAULT_CONFIG,
  type DecisionsByUnit,
  type MatchConfig,
  type MatchState,
} from './types.js';

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface ReplayHeader {
  sim: string;
  map: string;
  seed: string;
  config: MatchConfig;
}

export interface ReplayCycleRecord {
  c: number;
  d: DecisionsByUnit;
}

export interface Replay {
  header: ReplayHeader;
  cycles: ReplayCycleRecord[];
  finalHash: string;
}

/** Um bot decide para todas as unidades vivas do seu time, a cada ciclo. */
export type BotFn = (state: MatchState, cycle: number) => DecisionsByUnit;

export interface RunResult {
  finalState: MatchState;
  replay: Replay;
  events: string[];
}

export function runMatch(opts: {
  seed: string;
  bots: { cian: BotFn; magenta: BotFn };
  map?: MapDef;
  cfg?: MatchConfig;
}): RunResult {
  const map = opts.map ?? ARENA_ALPHA;
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  let state = createMatch(opts.seed, map, cfg);
  const cycles: ReplayCycleRecord[] = [];
  const events: string[] = [];

  while (!state.ended) {
    const decisions: DecisionsByUnit = {
      ...opts.bots.cian(state, state.cycle),
      ...opts.bots.magenta(state, state.cycle),
    };
    cycles.push({ c: state.cycle, d: decisions });
    const r = stepCycle(state, decisions, map, cfg);
    state = r.state;
    events.push(...r.events);
  }

  return {
    finalState: state,
    events,
    replay: {
      header: { sim: SIM_VERSION, map: map.id, seed: opts.seed, config: cfg },
      cycles,
      finalHash: stateHash(state),
    },
  };
}

/** Re-simula um replay do zero. Lança erro se o hash final divergir. */
export function resimulate(replay: Replay, map: MapDef = ARENA_ALPHA): MatchState {
  if (replay.header.map !== map.id) {
    throw new Error(`replay é do mapa ${replay.header.map}, recebido ${map.id}`);
  }
  let state = createMatch(replay.header.seed, map, replay.header.config);
  for (const rec of replay.cycles) {
    if (rec.c !== state.cycle) throw new Error(`replay fora de ordem no ciclo ${rec.c}`);
    state = stepCycle(state, rec.d, map, replay.header.config).state;
  }
  const hash = stateHash(state);
  if (hash !== replay.finalHash) {
    throw new Error(`hash divergente: esperado ${replay.finalHash}, obtido ${hash}`);
  }
  return state;
}

/** Serialização JSONL (header, ciclos, end). */
export function replayToJsonl(replay: Replay): string {
  const lines = [
    JSON.stringify({ h: replay.header }),
    ...replay.cycles.map((c) => JSON.stringify(c)),
    JSON.stringify({ end: { finalHash: replay.finalHash } }),
  ];
  return lines.join('\n') + '\n';
}

export function replayFromJsonl(jsonl: string): Replay {
  const lines = jsonl.trim().split('\n');
  const first = JSON.parse(lines[0]!) as { h: ReplayHeader };
  const last = JSON.parse(lines[lines.length - 1]!) as { end: { finalHash: string } };
  const cycles = lines.slice(1, -1).map((l) => JSON.parse(l) as ReplayCycleRecord);
  return { header: first.h, cycles, finalHash: last.end.finalHash };
}

// ---------------------------------------------------------------------------
// Partidas dirigidas por percepção (Sprint 2)
// ---------------------------------------------------------------------------

/**
 * Um bot de percepção decide para UMA unidade a partir apenas do que ela
 * percebe — o mesmo contrato dos agentes remotos (docs/04-protocolo-agente.md).
 */
export type PerceptionBotFn = (
  unitId: string,
  perception: PerceptionPayload,
  cycle: number,
) => DecisionPayload;

/**
 * Executa uma partida headless alimentando bots com percepções (não com o
 * estado onisciente). Produz o mesmo formato de replay de `runMatch`.
 */
export function runPerceptionMatch(opts: {
  seed: string;
  bots: { cian: PerceptionBotFn; magenta: PerceptionBotFn };
  map?: MapDef;
  cfg?: MatchConfig;
}): RunResult {
  const map = opts.map ?? ARENA_ALPHA;
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  let state = createMatch(opts.seed, map, cfg);
  const cycles: ReplayCycleRecord[] = [];
  const events: string[] = [];

  while (!state.ended) {
    const perceptions = buildPerceptions(state, map, cfg);
    const decisions: DecisionsByUnit = {};
    for (const unit of state.units) {
      if (!unit.alive) continue;
      const bot = opts.bots[unit.team];
      const perception = perceptions[unit.id];
      if (perception) decisions[unit.id] = bot(unit.id, perception, state.cycle);
    }
    cycles.push({ c: state.cycle, d: decisions });
    const r = stepCycle(state, decisions, map, cfg);
    state = r.state;
    events.push(...r.events);
  }

  return {
    finalState: state,
    events,
    replay: {
      header: { sim: SIM_VERSION, map: map.id, seed: opts.seed, config: cfg },
      cycles,
      finalHash: stateHash(state),
    },
  };
}

// ---------------------------------------------------------------------------
// Bots de referência (Sprint 1: random walk determinístico)
// ---------------------------------------------------------------------------

/**
 * Bot aleatório determinístico: o ruído vem de um stream derivado da semente,
 * do time e do ciclo — reproduzível por construção.
 */
export function randomBot(team: 'cian' | 'magenta'): BotFn {
  return (state, cycle) => {
    const decisions: DecisionsByUnit = {};
    for (const unit of state.units) {
      if (unit.team !== team || !unit.alive) continue;
      let rng: RngState = deriveStream(state.seed, 'bot', team, unit.id, cycle);
      const dir = nextInt(rng, 360);
      rng = dir.state;
      const spd = nextInt(rng, 11);
      const decision: DecisionPayload = {
        movement: { direction: dir.value, speed: spd.value / 10 },
      };
      decisions[unit.id] = decision;
    }
    return decisions;
  };
}

/** Bot imóvel (útil para testes). */
export function idleBot(): BotFn {
  return () => ({});
}
