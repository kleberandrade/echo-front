import { describe, expect, it } from 'vitest';
import { toFixed, fromFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerceptions } from './sensors.js';
import { createMatch, decideWinner, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;

function unit(s: MatchState, id: string) {
  return s.units.find((u) => u.id === id)!;
}

/** Coloca uma unidade em (x,y) e um fragmento spawned em (fx,fy). */
function withFragment(ux: number, uy: number, fx: number, fy: number): MatchState {
  const s = createMatch('obj-test', map, cfg);
  unit(s, 'cian_runner_1').x = toFixed(ux);
  unit(s, 'cian_runner_1').y = toFixed(uy);
  // Afasta os demais.
  unit(s, 'cian_observer_1').x = toFixed(2);
  unit(s, 'cian_observer_1').y = toFixed(2);
  unit(s, 'magenta_observer_1').x = toFixed(60);
  unit(s, 'magenta_observer_1').y = toFixed(33);
  unit(s, 'magenta_runner_1').x = toFixed(60);
  unit(s, 'magenta_runner_1').y = toFixed(30);
  s.fragments.push({ id: 'frag_t', x: toFixed(fx), y: toFixed(fy), state: 'spawned' });
  return s;
}

describe('fragmentos', () => {
  it('spawna deterministicamente no ciclo 0 a partir da semente', () => {
    const a = stepCycle(createMatch('spawn-1', map, cfg), {}, map, cfg).state;
    const b = stepCycle(createMatch('spawn-1', map, cfg), {}, map, cfg).state;
    expect(a.fragments.length).toBe(1);
    expect(a.fragments[0]!.x).toBe(b.fragments[0]!.x);
    expect(a.cycleEvents).toContain('fragment_spawned');
  });

  it('captura após 2 ciclos adjacente e o portador fica mais lento e barulhento', () => {
    let s = withFragment(30, 10, 30.5, 10.5);
    s = stepCycle(s, {}, map, cfg).state; // ciclo 1 de permanência
    expect(s.fragments.find((f) => f.id === 'frag_t')!.state).toBe('spawned');
    s = stepCycle(s, {}, map, cfg).state; // ciclo 2 → captura
    const frag = s.fragments.find((f) => f.id === 'frag_t')!;
    expect(frag.state).toBe('carried');
    expect(frag.carrier).toBe('cian_runner_1');
    expect(unit(s, 'cian_runner_1').carryingFragment).toBe(true);

    // Portador: velocidade efetiva reduzida (fator 0,8).
    const x0 = unit(s, 'cian_runner_1').x;
    s = stepCycle(s, { cian_runner_1: { movement: { direction: 0, speed: 1 } } }, map, cfg).state;
    const moved = fromFixed(unit(s, 'cian_runner_1').x - x0);
    expect(moved).toBeLessThan(3.0); // 3,5 sem carga → ~2,8 com carga
    expect(moved).toBeGreaterThan(2.5);
  });

  it('inimigo no raio bloqueia a captura', () => {
    let s = withFragment(30, 10, 30.5, 10.5);
    unit(s, 'magenta_runner_1').x = toFixed(31);
    unit(s, 'magenta_runner_1').y = toFixed(11);
    s = stepCycle(s, {}, map, cfg).state;
    s = stepCycle(s, {}, map, cfg).state;
    s = stepCycle(s, {}, map, cfg).state;
    expect(s.fragments.find((f) => f.id === 'frag_t')!.state).toBe('spawned');
  });

  it('entrega no núcleo pontua e vitória por 3 entregas encerra', () => {
    const core = map.cores.cian;
    let s = withFragment(core.x + 1, core.y, core.x + 1.5, core.y);
    s.score.cian = 2; // já entregou 2
    s = stepCycle(s, {}, map, cfg).state; // permanência 1
    s = stepCycle(s, {}, map, cfg).state; // captura
    // Já está tocando o núcleo → entrega no fechamento do próximo ciclo.
    s = stepCycle(s, {}, map, cfg).state;
    expect(s.score.cian).toBe(3);
    expect(s.ended).toBe(true);
    expect(s.endReason).toBe('fragments_delivered');
  });

  it('fragmento visível aparece em known_fragments com confiança 1.0', () => {
    const s = withFragment(30, 10, 34, 10);
    unit(s, 'cian_runner_1').heading = 0; // olhando para o fragmento
    const p = buildPerceptions(s, map, cfg)['cian_runner_1']!;
    expect(p.objective.known_fragments.length).toBe(1);
    expect(p.objective.known_fragments[0]!.confidence).toBe(1.0);
    expect(p.sensors.visual.some((v) => v.type === 'fragment')).toBe(true);
  });
});

describe('decideWinner (tiebreak)', () => {
  it('placar decide primeiro', () => {
    const s = createMatch('w', map, cfg);
    s.score.magenta = 1;
    expect(decideWinner(s)).toBe('magenta');
  });

  it('empate no placar → integridade decide', () => {
    const s = createMatch('w', map, cfg);
    unit(s, 'cian_runner_1').integrity = 10;
    expect(decideWinner(s)).toBe('magenta');
  });

  it('tudo igual → menor energia gasta vence; simetria total → draw', () => {
    const s = createMatch('w', map, cfg);
    expect(decideWinner(s)).toBe('draw');
    unit(s, 'cian_observer_1').energySpent = 30;
    expect(decideWinner(s)).toBe('magenta');
  });
});
