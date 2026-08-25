import { describe, expect, it } from 'vitest';
import { toFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerception } from './sensors.js';
import { createMatch, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;

function unit(s: MatchState, id: string) {
  return s.units.find((u) => u.id === id)!;
}

function apart(): MatchState {
  const s = createMatch('thermal-test', map, cfg);
  unit(s, 'cian_observer_1').x = toFixed(24);
  unit(s, 'cian_observer_1').y = toFixed(30);
  unit(s, 'cian_runner_1').x = toFixed(2);
  unit(s, 'cian_runner_1').y = toFixed(2);
  unit(s, 'magenta_runner_1').x = toFixed(30);
  unit(s, 'magenta_runner_1').y = toFixed(30);
  unit(s, 'magenta_observer_1').x = toFixed(62);
  unit(s, 'magenta_observer_1').y = toFixed(34);
  return s;
}

describe('sensor térmico', () => {
  it('detecta unidade OCULTA (contramedida do hide)', () => {
    let s = apart();
    s = stepCycle(s, { magenta_runner_1: { action: 'hide' } }, map, cfg).state;
    const p = buildPerception(unit(s, 'cian_observer_1'), s, map, cfg);
    // Visão e som não veem o oculto…
    expect(p.sensors.visual.length).toBe(0);
    expect(p.sensors.sound.length).toBe(0);
    // …mas o térmico sente o calor (direção ~leste, dist 6).
    expect(p.sensors.thermal.length).toBeGreaterThanOrEqual(1);
    const hot = [...p.sensors.thermal].sort((a, b) => b.intensity - a.intensity)[0]!;
    expect(hot.intensity).toBeGreaterThan(0.1);
  });

  it('torre de energia gera falso positivo fixo', () => {
    const s = createMatch('thermal-tower', map, cfg);
    const obs = unit(s, 'cian_observer_1');
    obs.x = toFixed(20); // torre (16,8) a ~9,4 u… posiciona perto
    obs.y = toFixed(10);
    const p = buildPerception(obs, s, map, cfg);
    expect(p.sensors.thermal.length).toBeGreaterThanOrEqual(1); // a torre "aquece"
  });

  it('rastro de calor persiste depois que a unidade passou', () => {
    let s = apart();
    // Runner magenta atravessa correndo…
    s = stepCycle(
      s,
      { magenta_runner_1: { movement: { direction: 90, speed: 1 } } },
      map,
      cfg,
    ).state;
    const trailCountMoving = s.heatTrails.length;
    expect(trailCountMoving).toBeGreaterThan(0);
    // …para; o rastro decai mas ainda existe por alguns ciclos.
    s = stepCycle(s, { magenta_runner_1: { movement: { speed: 0 } } }, map, cfg).state;
    expect(s.heatTrails.length).toBeGreaterThan(0);
    let cool = s;
    for (let i = 0; i < cfg.sensors.heatTrailCycles + 1; i++) {
      cool = stepCycle(cool, {}, map, cfg).state;
    }
    expect(cool.heatTrails.length).toBe(0);
  });
});

describe('composição de times', () => {
  it('phantom instanciável via composition', () => {
    const custom = {
      ...cfg,
      composition: {
        cian: ['observer', 'runner'] as const,
        magenta: ['phantom', 'runner'] as const,
      },
    };
    const s = createMatch('phantom-1', map, custom as typeof cfg);
    expect(s.units.map((u) => u.id)).toContain('magenta_phantom_1');
    expect(s.units.length).toBe(4);
  });

  it('composições com 3 unidades usam os spawns extras', () => {
    const custom = {
      ...cfg,
      composition: {
        cian: ['observer', 'runner', 'phantom'] as const,
        magenta: ['observer', 'runner', 'phantom'] as const,
      },
    };
    const s = createMatch('trio', map, custom as typeof cfg);
    expect(s.units.length).toBe(6);
  });
});
