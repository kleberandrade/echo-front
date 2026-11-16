/**
 * Carrega um replay JSONL e pré-computa o estado de cada ciclo rodando o
 * `packages/sim` no browser — scrubbing instantâneo, sem servidor.
 */
import {
  ARENA_ALPHA,
  DEFAULT_CONFIG,
  createMatch,
  replayFromJsonl,
  stateHash,
  stepCycle,
  type MatchState,
  type Replay,
} from '@echo-front/sim';
import type { DecisionPayload } from '@echo-front/protocol';

export interface LoadedReplay {
  replay: Replay;
  /** states[i] = estado APÓS o ciclo i (states[0] é o estado inicial). */
  states: MatchState[];
  verified: boolean;
}

export function loadReplay(jsonl: string): LoadedReplay {
  const replay = replayFromJsonl(jsonl);
  if (replay.header.map !== ARENA_ALPHA.id) {
    throw new Error(`Unsupported replay map: ${replay.header.map}`);
  }
  // Merge defensivo: replays de versões minor antigas ganham os defaults novos.
  const cfg = { ...DEFAULT_CONFIG, ...replay.header.config };
  let state = createMatch(replay.header.seed, ARENA_ALPHA, cfg);
  const states: MatchState[] = [state];
  for (const rec of replay.cycles) {
    if (rec.c !== state.cycle) throw new Error(`Replay out of sequence at cycle ${rec.c}`);
    state = stepCycle(state, rec.d, ARENA_ALPHA, cfg).state;
    states.push(state);
  }
  return { replay, states, verified: stateHash(state) === replay.finalHash };
}

/** Decisão registrada de uma unidade no ciclo `c` (para o painel de debug). */
export function decisionAt(
  replay: Replay,
  cycle: number,
  unitId: string,
): DecisionPayload | undefined {
  return replay.cycles.find((r) => r.c === cycle)?.d[unitId];
}

/** Event feed acumulado: [ciclo, evento][] até o índice dado. */
export function eventsUpTo(states: MatchState[], upTo: number): [number, string][] {
  const out: [number, string][] = [];
  for (let i = 1; i <= Math.min(upTo, states.length - 1); i++) {
    for (const e of states[i]!.cycleEvents) out.push([i - 1, e]);
  }
  return out.reverse(); // mais recente primeiro
}
