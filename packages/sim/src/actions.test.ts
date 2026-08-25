import { describe, expect, it } from 'vitest';
import { toFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerceptions } from './sensors.js';
import { createMatch, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;
const ac = cfg.actions;

function unit(s: MatchState, id: string) {
  return s.units.find((u) => u.id === id)!;
}

function apart(): MatchState {
  const s = createMatch('act-test', map, cfg);
  unit(s, 'cian_runner_1').x = toFixed(20);
  unit(s, 'cian_runner_1').y = toFixed(10);
  unit(s, 'cian_observer_1').x = toFixed(2);
  unit(s, 'cian_observer_1').y = toFixed(2);
  unit(s, 'magenta_runner_1').x = toFixed(30);
  unit(s, 'magenta_runner_1').y = toFixed(10);
  unit(s, 'magenta_runner_1').heading = 180;
  unit(s, 'magenta_observer_1').x = toFixed(60);
  unit(s, 'magenta_observer_1').y = toFixed(33);
  return s;
}

describe('deploy_decoy', () => {
  it('cria decoy que soa e ecoa como unidade para o inimigo', () => {
    let s = apart();
    // Runner magenta olha para longe do decoy para não desmascará-lo.
    unit(s, 'magenta_runner_1').heading = 0;
    const e0 = unit(s, 'cian_runner_1').energy;
    s = stepCycle(
      s,
      { cian_runner_1: { action: 'deploy_decoy', target: [22, 10] } },
      map,
      cfg,
    ).state;
    expect(unit(s, 'cian_runner_1').energy).toBe(e0 - ac.decoyCost + cfg.energyRegenPerCycle);
    expect(s.decoys.length).toBe(1);

    const p = buildPerceptions(s, map, cfg)['magenta_runner_1']!;
    expect(p.sensors.sound.length).toBeGreaterThanOrEqual(1); // ouve o decoy

    // Radar inimigo ecoa o decoy como 'unit' (indistinguível).
    let s2 = structuredClone(s);
    unit(s2, 'magenta_runner_1').energy = 100;
    s2 = stepCycle(s2, { magenta_runner_1: { action: 'pulse_scan' } }, map, cfg).state;
    const pr = buildPerceptions(s2, map, cfg)['magenta_runner_1']!;
    expect(pr.sensors.radar.filter((r) => r.type === 'unit').length).toBeGreaterThanOrEqual(1);
  });

  it('decoy morre ao ser visto por visão direta', () => {
    let s = apart();
    unit(s, 'magenta_runner_1').heading = 0; // olhando para longe: decoy sobrevive
    s = stepCycle(
      s,
      { cian_runner_1: { action: 'deploy_decoy', target: [22, 10] } },
      map,
      cfg,
    ).state;
    expect(s.decoys.length).toBe(1);
    // Vira o runner magenta para o decoy (dist 8, dentro de 90°/14).
    s = stepCycle(s, { magenta_runner_1: { movement: { direction: 180 } } }, map, cfg).state;
    expect(s.decoys.length).toBe(0);
    expect(s.cycleEvents).toContain('decoy_destroyed');
  });

  it('decoy expira após decoyLifeCycles', () => {
    let s = apart();
    unit(s, 'magenta_runner_1').heading = 0; // nunca olha
    s = stepCycle(
      s,
      { cian_runner_1: { action: 'deploy_decoy', target: [18, 10] } },
      map,
      cfg,
    ).state;
    for (let i = 0; i < ac.decoyLifeCycles; i++) s = stepCycle(s, {}, map, cfg).state;
    expect(s.decoys.length).toBe(0);
  });
});

describe('hide', () => {
  it('oculto some da visão, som e radar; expira após 3 ciclos', () => {
    let s = apart();
    // Frente a frente, visíveis.
    unit(s, 'magenta_runner_1').heading = 180;
    unit(s, 'cian_runner_1').speed = 500;
    expect(
      buildPerceptions(s, map, cfg)['magenta_runner_1']!.sensors.visual.length,
    ).toBeGreaterThan(0);

    s = stepCycle(s, { cian_runner_1: { action: 'hide' } }, map, cfg).state;
    const hidden = unit(s, 'cian_runner_1');
    expect(hidden.hiddenCycles).toBeGreaterThan(0);
    expect(hidden.speed).toBe(0);
    const p = buildPerceptions(s, map, cfg)['magenta_runner_1']!;
    expect(p.sensors.visual.length).toBe(0);
    expect(p.sensors.sound.length).toBe(0);

    // Radar não encontra oculto.
    let s2 = structuredClone(s);
    unit(s2, 'magenta_runner_1').energy = 100;
    s2 = stepCycle(s2, { magenta_runner_1: { action: 'pulse_scan' } }, map, cfg).state;
    expect(
      buildPerceptions(s2, map, cfg)['magenta_runner_1']!.sensors.radar.filter(
        (r) => r.type === 'unit',
      ).length,
    ).toBe(0);

    // Expira: hideCycles fecha e a unidade reaparece.
    s = stepCycle(s, {}, map, cfg).state;
    s = stepCycle(s, {}, map, cfg).state;
    expect(unit(s, 'cian_runner_1').hiddenCycles).toBe(0);
  });

  it('mover quebra a camuflagem', () => {
    let s = apart();
    s = stepCycle(s, { cian_runner_1: { action: 'hide' } }, map, cfg).state;
    expect(unit(s, 'cian_runner_1').hiddenCycles).toBeGreaterThan(0);
    s = stepCycle(s, { cian_runner_1: { movement: { direction: 0, speed: 1 } } }, map, cfg).state;
    expect(unit(s, 'cian_runner_1').hiddenCycles).toBe(0);
  });
});

describe('speed_boost e strike', () => {
  it('boost acelera o runner, drena energia e faz barulho', () => {
    // Área aberta: (40,18) indo para o sul não cruza obstáculos.
    const openStart = (s: MatchState) => {
      unit(s, 'cian_runner_1').x = toFixed(40);
      unit(s, 'cian_runner_1').y = toFixed(18);
      return s;
    };
    let sNorm = openStart(apart());
    sNorm = stepCycle(sNorm, { cian_runner_1: { movement: { direction: 90, speed: 1 } } }, map, cfg)
      .state;
    const normal = unit(sNorm, 'cian_runner_1').y - toFixed(18);
    expect(normal).toBe(3500); // 5 ticks × 700

    let sBoost = openStart(apart());
    const e0 = unit(sBoost, 'cian_runner_1').energy;
    sBoost = stepCycle(
      sBoost,
      { cian_runner_1: { movement: { direction: 90, speed: 1 }, action: 'speed_boost' } },
      map,
      cfg,
    ).state;
    const boosted = unit(sBoost, 'cian_runner_1').y - toFixed(18);
    expect(boosted).toBeGreaterThan(normal * 1.4);
    expect(unit(sBoost, 'cian_runner_1').energy).toBeLessThan(e0);
  });

  it('strike causa dano; destruição derruba fragmento e emite evento', () => {
    let s = apart();
    unit(s, 'magenta_runner_1').x = toFixed(22); // dentro do alcance 3
    unit(s, 'magenta_runner_1').integrity = ac.strikeDamage; // um golpe mata
    unit(s, 'magenta_runner_1').carryingFragment = true;
    s.fragments.push({
      id: 'frag_c',
      x: toFixed(22),
      y: toFixed(10),
      state: 'carried',
      carrier: 'magenta_runner_1',
    });
    s = stepCycle(s, { cian_runner_1: { action: 'strike' } }, map, cfg).state;
    const victim = unit(s, 'magenta_runner_1');
    expect(victim.alive).toBe(false);
    const frag = s.fragments.find((f) => f.id === 'frag_c')!;
    expect(frag.state).toBe('dropped');
    expect(frag.carrier).toBeUndefined();
    expect(s.cycleEvents).toContain('unit_destroyed:magenta_runner_1');
  });

  it('strike fora de alcance não gasta energia', () => {
    let s = apart(); // inimigo mais próximo a 10 u
    const e0 = unit(s, 'cian_runner_1').energy;
    s = stepCycle(s, { cian_runner_1: { action: 'strike' } }, map, cfg).state;
    expect(unit(s, 'cian_runner_1').energy).toBe(e0 + cfg.energyRegenPerCycle);
  });
});
