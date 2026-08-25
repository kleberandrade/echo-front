/**
 * Débitos quitados na sprint-07: strike com mira e aliados stale com
 * último snapshot conhecido.
 */
import { describe, expect, it } from 'vitest';
import { toFixed, fromFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerception } from './sensors.js';
import { createMatch, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;

function unit(s: MatchState, id: string) {
  return s.units.find((u) => u.id === id)!;
}

describe('strike com target', () => {
  it('mira escolhe o inimigo mais próximo do PONTO, não do atacante', () => {
    const s = createMatch('aim-1', map, cfg);
    // Atacante em (20,10); dois inimigos no alcance: (21,10) e (22.5,10).
    unit(s, 'cian_runner_1').x = toFixed(20);
    unit(s, 'cian_runner_1').y = toFixed(10);
    unit(s, 'magenta_observer_1').x = toFixed(21);
    unit(s, 'magenta_observer_1').y = toFixed(10);
    unit(s, 'magenta_runner_1').x = toFixed(22.5);
    unit(s, 'magenta_runner_1').y = toFixed(10);
    unit(s, 'cian_observer_1').x = toFixed(2);
    unit(s, 'cian_observer_1').y = toFixed(2);

    // Mira no mais DISTANTE de si (22.5,10): ele deve levar o dano.
    const after = stepCycle(
      s,
      { cian_runner_1: { action: 'strike', target: [22.5, 10] } },
      map,
      cfg,
    ).state;
    expect(unit(after, 'magenta_runner_1').integrity).toBeLessThan(80);
    expect(unit(after, 'magenta_observer_1').integrity).toBe(60); // intacto
  });
});

describe('aliados sob interferência', () => {
  it('mantém o ÚLTIMO snapshot conhecido (posições defasadas, stale)', () => {
    let s = createMatch('stale-1', map, cfg);
    // Observer cian fora da zona; runner cian visível em (10,10).
    unit(s, 'cian_observer_1').x = toFixed(20);
    unit(s, 'cian_observer_1').y = toFixed(10);
    unit(s, 'cian_runner_1').x = toFixed(10);
    unit(s, 'cian_runner_1').y = toFixed(10);
    s = stepCycle(s, {}, map, cfg).state; // fora da zona: snapshot atualizado

    // Observer entra na zona de interferência; runner corre para longe.
    unit(s, 'cian_observer_1').x = toFixed(31);
    unit(s, 'cian_observer_1').y = toFixed(17);
    s = stepCycle(s, { cian_runner_1: { movement: { direction: 90, speed: 1 } } }, map, cfg).state;
    s = stepCycle(s, {}, map, cfg).state;

    const p = buildPerception(unit(s, 'cian_observer_1'), s, map, cfg);
    expect(p.events).toContain('communication_interference');
    const ally = p.allies.find((a) => a.unitId === 'cian_runner_1')!;
    expect(ally.stale).toBe(true);
    // Posição reportada é a ANTIGA (~10,10), não a atual do runner.
    expect(ally.position[0]).toBeCloseTo(10, 0);
    const actualY = fromFixed(unit(s, 'cian_runner_1').y);
    expect(Math.abs(ally.position[1] - actualY)).toBeGreaterThan(3);
  });
});
