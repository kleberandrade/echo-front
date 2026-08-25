import { describe, expect, it } from 'vitest';
import { fromFixed, toFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { createMatch, step, stepCycle } from './step.js';
import { DEFAULT_CONFIG } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;

describe('createMatch', () => {
  it('cria 4 unidades ordenadas por id, nos spawns do mapa', () => {
    const s = createMatch('t', map, cfg);
    expect(s.units.map((u) => u.id)).toEqual([
      'cian_observer_1',
      'cian_runner_1',
      'magenta_observer_1',
      'magenta_runner_1',
    ]);
    const obs = s.units[0]!;
    expect(fromFixed(obs.x)).toBe(5);
    expect(fromFixed(obs.y)).toBe(16);
  });
});

describe('movimento', () => {
  it('runner anda para leste na velocidade máxima', () => {
    let s = createMatch('t', map, cfg);
    const r = stepCycle(s, { cian_runner_1: { movement: { direction: 0, speed: 1 } } }, map, cfg);
    s = r.state;
    const runner = s.units.find((u) => u.id === 'cian_runner_1')!;
    // 5 ticks × 700 fixed = 3,5 unidades para leste a partir de x=5.
    expect(fromFixed(runner.x)).toBeCloseTo(8.5, 1);
    expect(fromFixed(runner.y)).toBeCloseTo(20, 1);
  });

  it('unidade para ao encontrar obstáculo', () => {
    let s = createMatch('t', map, cfg);
    // Observer em (5,16); obstáculo (14,6,2,8) cobre y=6..13 — usa a parede da borda oeste.
    const decisions = { cian_observer_1: { movement: { direction: 180, speed: 1 } } };
    for (let c = 0; c < 8; c++) s = stepCycle(s, decisions, map, cfg).state;
    const obs = s.units.find((u) => u.id === 'cian_observer_1')!;
    // Não atravessa a borda x=0.
    expect(obs.x).toBeGreaterThanOrEqual(0);
    expect(fromFixed(obs.x)).toBeLessThan(5);
  });

  it('sem decisão nova, mantém o rumo anterior (no-op semantics)', () => {
    let s = createMatch('t', map, cfg);
    s = stepCycle(s, { cian_runner_1: { movement: { direction: 0, speed: 0.5 } } }, map, cfg).state;
    const x1 = s.units.find((u) => u.id === 'cian_runner_1')!.x;
    s = stepCycle(s, {}, map, cfg).state; // nenhum comando novo
    const x2 = s.units.find((u) => u.id === 'cian_runner_1')!.x;
    expect(x2).toBeGreaterThan(x1);
  });

  it('duas unidades não se sobrepõem', () => {
    let s = createMatch('t', map, cfg);
    // Runner cian (5,20) sobe em direção ao observer cian (5,16).
    const decisions = { cian_runner_1: { movement: { direction: 270, speed: 1 } } };
    for (let c = 0; c < 10; c++) s = stepCycle(s, decisions, map, cfg).state;
    const a = s.units.find((u) => u.id === 'cian_observer_1')!;
    const b = s.units.find((u) => u.id === 'cian_runner_1')!;
    const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const min = (2 * cfg.unitRadius) ** 2;
    expect(d2).toBeGreaterThanOrEqual(min * 0.9); // tolerância de um passo
  });
});

describe('energia e relógio', () => {
  it('regenera por ciclo e cobra movimento rápido', () => {
    let s = createMatch('t', map, cfg);
    const e0 = s.units[0]!.energy;
    s = stepCycle(s, { cian_observer_1: { movement: { direction: 90, speed: 1 } } }, map, cfg).state;
    const fast = s.units[0]!.energy;
    expect(fast).toBe(e0 + cfg.energyRegenPerCycle - cfg.fastMoveCostPerCycle);
  });

  it('energia não passa do máximo da classe', () => {
    let s = createMatch('t', map, cfg);
    for (let c = 0; c < 30; c++) s = stepCycle(s, {}, map, cfg).state;
    for (const u of s.units) {
      expect(u.energy).toBeLessThanOrEqual(cfg.classes[u.class].maxEnergy);
    }
  });

  it('partida termina por tempo no ciclo configurado', () => {
    let s = createMatch('t', map, { ...cfg, totalCycles: 3 });
    for (let c = 0; c < 5; c++) s = stepCycle(s, {}, map, { ...cfg, totalCycles: 3 }).state;
    expect(s.ended).toBe(true);
    expect(s.endReason).toBe('time_up');
    expect(s.cycle).toBe(3);
  });

  it('step é pura: estado de entrada não é modificado', () => {
    const s = createMatch('t', map, cfg);
    const json = JSON.stringify(s);
    step(s, { cian_runner_1: { movement: { direction: 0, speed: 1 } } }, map, cfg);
    expect(JSON.stringify(s)).toBe(json);
  });

  it('torre de energia acelera a recarga', () => {
    const s = createMatch('t', map, cfg);
    // Coloca o observer dentro do raio da torre (16,8) e drena energia.
    const hacked = structuredClone(s);
    const obs = hacked.units.find((u) => u.id === 'cian_observer_1')!;
    obs.x = toFixed(16);
    obs.y = toFixed(8);
    obs.energy = 50;
    const after = stepCycle(hacked, {}, map, cfg).state;
    const e = after.units.find((u) => u.id === 'cian_observer_1')!.energy;
    expect(e).toBe(50 + cfg.energyRegenPerCycle + cfg.towerBonusPerCycle);
  });
});
