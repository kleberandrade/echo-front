import { describe, expect, it } from 'vitest';
import { fromFixed, toFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerception } from './sensors.js';
import { createMatch, decideWinner, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchConfig, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const SIEGE: MatchConfig = { ...DEFAULT_CONFIG, mode: 'core_siege' };
const SILENT: MatchConfig = {
  ...DEFAULT_CONFIG,
  mode: 'silent_hunt',
  sensors: { ...DEFAULT_CONFIG.sensors, maxPulsesPerMatch: 2 },
};

function unit(s: MatchState, id: string) {
  return s.units.find((u) => u.id === id)!;
}

describe('core_siege', () => {
  it('sorteia o par de núcleos por semente (determinístico, espelhado)', () => {
    const a = createMatch('siege-7', map, SIEGE);
    const b = createMatch('siege-7', map, SIEGE);
    expect(a.corePositions).toEqual(b.corePositions);
    const site = map.coreSites.find(
      (c) => toFixed(c.cian.x) === a.corePositions.cian.x && toFixed(c.cian.y) === a.corePositions.cian.y,
    );
    expect(site).toBeDefined();
    expect(a.corePositions.magenta.x).toBe(toFixed(site!.magenta.x));
    // Sementes diferentes podem sortear pares diferentes.
    const seeds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    const picks = new Set(seeds.map((sd) => createMatch(sd, map, SIEGE).corePositions.cian.x));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('não spawna fragmentos', () => {
    let s = createMatch('siege-frag', map, SIEGE);
    for (let i = 0; i < 3; i++) s = stepCycle(s, {}, map, SIEGE).state;
    expect(s.fragments.length).toBe(0);
  });

  it('núcleo inimigo só aparece na visão a curta distância', () => {
    const s = createMatch('siege-vis', map, SIEGE);
    const core = s.corePositions.magenta;
    const obs = unit(s, 'cian_observer_1');
    // Longe (13u > coreVisionRange 10, dentro do alcance de visão 18): invisível.
    obs.x = core.x - toFixed(13);
    obs.y = core.y;
    obs.heading = 0;
    let p = buildPerception(obs, s, map, SIEGE);
    expect(p.sensors.visual.some((v) => v.type === 'core')).toBe(false);
    // Perto (8u): visível como 'core'.
    obs.x = core.x - toFixed(8);
    p = buildPerception(obs, s, map, SIEGE);
    expect(p.sensors.visual.some((v) => v.type === 'core')).toBe(true);
    expect(p.objective.mode).toBe('core_siege');
  });

  it('strike destrói o núcleo e encerra com core_destroyed', () => {
    let s = createMatch('siege-win', map, SIEGE);
    const core = s.corePositions.magenta;
    const striker = unit(s, 'cian_runner_1');
    striker.x = core.x - toFixed(2);
    striker.y = core.y;
    striker.energy = 100;
    // Afasta os demais.
    unit(s, 'magenta_runner_1').x = toFixed(32);
    unit(s, 'magenta_runner_1').y = toFixed(2);
    unit(s, 'magenta_observer_1').x = toFixed(32);
    unit(s, 'magenta_observer_1').y = toFixed(33);

    const hits = SIEGE.coreSiege.coreIntegrity / SIEGE.coreSiege.strikeDamageToCore;
    for (let i = 0; i < hits && !s.ended; i++) {
      s = stepCycle(
        s,
        { cian_runner_1: { action: 'strike', target: [fromFixed(core.x), fromFixed(core.y)] } },
        map,
        SIEGE,
      ).state;
      // recarrega energia para o teste
      unit(s, 'cian_runner_1').energy = 100;
    }
    expect(s.coreIntegrity.magenta).toBe(0);
    expect(s.ended).toBe(true);
    expect(s.endReason).toBe('core_destroyed');
    expect(decideWinner(s)).toBe('cian');
  });
});

describe('silent_hunt', () => {
  it('limita pulse_scan por unidade; além da cota vira no-op', () => {
    let s = createMatch('silent-1', map, SILENT);
    const obs = () => unit(s, 'cian_observer_1');
    for (let i = 0; i < 4; i++) {
      // espera o cooldown entre pulsos
      s = stepCycle(s, { cian_observer_1: { action: 'pulse_scan' } }, map, SILENT).state;
      for (let c = 0; c < SILENT.sensors.radarCooldownCycles; c++) {
        s = stepCycle(s, {}, map, SILENT).state;
      }
      obs().energy = 120;
    }
    expect(obs().pulsesUsed).toBe(2); // cota de 2, tentou 4
  });

  it('fragmentos e entregas seguem valendo (é um data_run restrito)', () => {
    let s = createMatch('silent-2', map, SILENT);
    s = stepCycle(s, {}, map, SILENT).state;
    expect(s.fragments.length).toBe(1);
    expect(buildPerception(unit(s, 'cian_runner_1'), s, map, SILENT).objective.mode).toBe(
      'silent_hunt',
    );
  });
});
