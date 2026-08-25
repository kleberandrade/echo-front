import { describe, expect, it } from 'vitest';
import { fromFixed } from './fixed.js';
import { ARENA_ALPHA, isBlockedFixed } from './map.js';
import { randomBot, replayFromJsonl, replayToJsonl, resimulate, runMatch } from './match.js';
import { DEFAULT_CONFIG } from './types.js';

const SHORT = { ...DEFAULT_CONFIG, totalCycles: 40 };

describe('determinismo', () => {
  it('mesma semente → mesmo finalHash (execuções independentes)', () => {
    const a = runMatch({ seed: 'det-1', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    const b = runMatch({ seed: 'det-1', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    expect(a.replay.finalHash).toBe(b.replay.finalHash);
    expect(JSON.stringify(a.finalState)).toBe(JSON.stringify(b.finalState));
  });

  it('sementes diferentes → estados diferentes', () => {
    const a = runMatch({ seed: 'det-1', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    const b = runMatch({ seed: 'det-2', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    expect(a.replay.finalHash).not.toBe(b.replay.finalHash);
  });

  it('resimulate reproduz o replay e valida o hash', () => {
    const r = runMatch({ seed: 'det-3', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    const final = resimulate(r.replay);
    expect(JSON.stringify(final)).toBe(JSON.stringify(r.finalState));
  });

  it('resimulate detecta adulteração', () => {
    const r = runMatch({ seed: 'det-4', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    const tampered = structuredClone(r.replay);
    tampered.cycles[5]!.d['cian_runner_1'] = { movement: { direction: 42, speed: 1 } };
    expect(() => resimulate(tampered)).toThrow(/hash divergente/);
  });

  it('JSONL round-trip preserva o replay', () => {
    const r = runMatch({ seed: 'det-5', cfg: SHORT, bots: { cian: randomBot('cian'), magenta: randomBot('magenta') } });
    const back = replayFromJsonl(replayToJsonl(r.replay));
    expect(back.finalHash).toBe(r.replay.finalHash);
    expect(resimulate(back).cycle).toBe(SHORT.totalCycles);
  });
});

describe('invariantes sob estresse', () => {
  it('50 partidas aleatórias sem violar invariantes', () => {
    for (let i = 0; i < 50; i++) {
      const r = runMatch({
        seed: `stress-${i}`,
        cfg: { ...DEFAULT_CONFIG, totalCycles: 30 },
        bots: { cian: randomBot('cian'), magenta: randomBot('magenta') },
      });
      for (const u of r.finalState.units) {
        expect(Number.isFinite(u.x)).toBe(true);
        expect(Number.isFinite(u.y)).toBe(true);
        expect(Number.isInteger(u.x)).toBe(true); // fixed-point puro
        expect(Number.isInteger(u.y)).toBe(true);
        expect(u.energy).toBeGreaterThanOrEqual(0);
        expect(u.energy).toBeLessThanOrEqual(DEFAULT_CONFIG.classes[u.class].maxEnergy);
        expect(fromFixed(u.x)).toBeGreaterThanOrEqual(0);
        expect(fromFixed(u.x)).toBeLessThan(ARENA_ALPHA.width);
        expect(fromFixed(u.y)).toBeGreaterThanOrEqual(0);
        expect(fromFixed(u.y)).toBeLessThan(ARENA_ALPHA.height);
        expect(isBlockedFixed(ARENA_ALPHA, u.x, u.y)).toBe(false);
      }
      // Sem sobreposição entre unidades vivas.
      const alive = r.finalState.units.filter((u) => u.alive);
      for (let a = 0; a < alive.length; a++) {
        for (let b = a + 1; b < alive.length; b++) {
          const d2 = (alive[a]!.x - alive[b]!.x) ** 2 + (alive[a]!.y - alive[b]!.y) ** 2;
          expect(d2).toBeGreaterThan(0);
        }
      }
    }
  });
});
