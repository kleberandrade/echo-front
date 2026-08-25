import { describe, expect, it } from 'vitest';
import { nextFloat, nextU32, seedRng } from './index.js';

describe('PRNG determinístico', () => {
  it('mesma semente produz a mesma sequência', () => {
    let a = seedRng('match-42');
    let b = seedRng('match-42');
    for (let i = 0; i < 100; i++) {
      const ra = nextU32(a);
      const rb = nextU32(b);
      expect(ra.value).toBe(rb.value);
      a = ra.state;
      b = rb.state;
    }
  });

  it('sementes diferentes divergem', () => {
    const a = nextU32(seedRng('match-42'));
    const b = nextU32(seedRng('match-43'));
    expect(a.value).not.toBe(b.value);
  });

  it('nextFloat fica em [0, 1)', () => {
    let s = seedRng('float-test');
    for (let i = 0; i < 1000; i++) {
      const r = nextFloat(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      s = r.state;
    }
  });

  it('estado é imutável (chamadas repetidas com o mesmo estado repetem o valor)', () => {
    const s = seedRng('immutable');
    expect(nextU32(s).value).toBe(nextU32(s).value);
  });
});
