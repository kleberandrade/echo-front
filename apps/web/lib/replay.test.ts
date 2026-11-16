import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { replayFromJsonl, replayToJsonl, stateHash } from '@echo-front/sim';
import { decisionAt, eventsUpTo, loadReplay } from './replay';

const demo = readFileSync(new URL('../public/replays/demo.replay.jsonl', import.meta.url), 'utf8');

describe('browser replay loading', () => {
  it('reproduces every demo cycle and verifies its final state', () => {
    const loaded = loadReplay(demo);
    expect(loaded.verified).toBe(true);
    expect(loaded.states).toHaveLength(loaded.replay.cycles.length + 1);
    expect(loaded.states[0]!.cycle).toBe(0);
    expect(stateHash(loaded.states.at(-1)!)).toBe(loaded.replay.finalHash);
  });

  it('reports a changed hash as unverified', () => {
    const replay = replayFromJsonl(demo);
    replay.finalHash = 'tampered';
    expect(loadReplay(replayToJsonl(replay)).verified).toBe(false);
  });

  it('rejects a replay for an unsupported arena before simulating it', () => {
    const replay = replayFromJsonl(demo);
    replay.header.map = 'unknown-arena';
    expect(() => loadReplay(replayToJsonl(replay))).toThrow(/map/i);
  });

  it('rejects cycles out of sequence even when the decisions and final hash are unchanged', () => {
    const replay = replayFromJsonl(demo);
    replay.cycles[0]!.c = 7;
    expect(() => loadReplay(replayToJsonl(replay))).toThrow(/cycle/i);
  });

  it('retrieves recorded decisions and bounds the newest-first event feed', () => {
    const loaded = loadReplay(demo);
    const record = loaded.replay.cycles.find((cycle) => Object.keys(cycle.d).length > 0)!;
    const unitId = Object.keys(record.d)[0]!;
    expect(decisionAt(loaded.replay, record.c, unitId)).toEqual(record.d[unitId]);
    expect(decisionAt(loaded.replay, -1, unitId)).toBeUndefined();
    expect(eventsUpTo(loaded.states, 0)).toEqual([]);
    const feed = eventsUpTo(loaded.states, loaded.states.length + 10);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every(([cycle]) => cycle < loaded.replay.cycles.length)).toBe(true);
    expect(feed.map(([cycle]) => cycle)).toEqual(
      feed.map(([cycle]) => cycle).sort((a, b) => b - a),
    );
  });

  it('includes events from the requested cycle, with newer events first', () => {
    const initial = loadReplay(demo).states[0]!;
    const states = [
      initial,
      { ...initial, cycleEvents: ['first'] },
      { ...initial, cycleEvents: ['second'] },
    ];
    expect(eventsUpTo(states, 1)).toEqual([[0, 'first']]);
    expect(eventsUpTo(states, 2)).toEqual([
      [1, 'second'],
      [0, 'first'],
    ]);
  });
});
