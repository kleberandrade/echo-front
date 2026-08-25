import { describe, expect, it } from 'vitest';
import { toFixed } from './fixed.js';
import { ARENA_ALPHA } from './map.js';
import { buildPerception, buildPerceptions, obstaclesCrossed } from './sensors.js';
import { createMatch, stepCycle } from './step.js';
import { DEFAULT_CONFIG, type MatchState } from './types.js';

const map = ARENA_ALPHA;
const cfg = DEFAULT_CONFIG;

/** Estado de teste com unidades posicionadas manualmente. */
function place(positions: Record<string, [number, number, number?]>): MatchState {
  const s = createMatch('sensor-test', map, cfg);
  for (const [id, [x, y, heading]] of Object.entries(positions)) {
    const u = s.units.find((v) => v.id === id)!;
    u.x = toFixed(x);
    u.y = toFixed(y);
    if (heading !== undefined) u.heading = heading;
  }
  return s;
}

describe('visão', () => {
  it('detecta inimigo no cone com linha de visão livre', () => {
    // Observer cian em (20,18) olhando para leste; runner magenta a 8 u.
    const s = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [28, 18],
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    const p = buildPerception(s.units.find((u) => u.id === 'cian_observer_1')!, s, map, cfg);
    expect(p.sensors.visual.length).toBe(1);
    const r = p.sensors.visual[0]!;
    expect(r.type).toBe('unit');
    expect(r.class_guess).toBe('runner');
    expect(r.direction).toBe(0);
    expect(r.distance).toBeCloseTo(8, 0);
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('não vê fora do cone', () => {
    // Alvo diretamente atrás (oeste) do observer olhando para leste.
    const s = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [12, 18],
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    const p = buildPerception(s.units.find((u) => u.id === 'cian_observer_1')!, s, map, cfg);
    expect(p.sensors.visual.length).toBe(0);
  });

  it('obstáculo bloqueia a visão (oclusão)', () => {
    // Obstáculo (24,20,3,3): linha de (22,21.5) até (29,21.5) cruza x=24..26 em y=21.
    const s = place({
      cian_observer_1: [22, 21.5, 0],
      magenta_runner_1: [29, 21.5],
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    expect(
      obstaclesCrossed(map, toFixed(22), toFixed(21.5), toFixed(29), toFixed(21.5)),
    ).toBeGreaterThan(0);
    const p = buildPerception(s.units.find((u) => u.id === 'cian_observer_1')!, s, map, cfg);
    expect(p.sensors.visual.length).toBe(0);
  });

  it('longe demais → sem leitura; meia distância → confiança menor', () => {
    const far = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [39, 18], // 19 > alcance 18 do observer
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    expect(
      buildPerception(far.units.find((u) => u.id === 'cian_observer_1')!, far, map, cfg).sensors
        .visual.length,
    ).toBe(0);

    const mid = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [35, 18], // 15/18 do alcance → confiança baixa
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    const r = buildPerception(mid.units.find((u) => u.id === 'cian_observer_1')!, mid, map, cfg)
      .sensors.visual[0]!;
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.type).toBe('movement');
    expect(r.class_guess).toBeUndefined();
  });
});

describe('som', () => {
  function moving(): MatchState {
    const s = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [30, 18],
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    s.units.find((u) => u.id === 'magenta_runner_1')!.speed = 1000;
    return s;
  }

  it('unidade em movimento gera leitura com jitter ≤ ±25°', () => {
    const s = moving();
    const p = buildPerception(s.units.find((u) => u.id === 'cian_observer_1')!, s, map, cfg);
    expect(p.sensors.sound.length).toBe(1);
    const r = p.sensors.sound[0]!;
    // Direção real = 0; jitter em [-25, +25] → leitura em [335..360)∪[0..25].
    const diff = Math.min(r.direction, 360 - r.direction);
    expect(diff).toBeLessThanOrEqual(cfg.sensors.soundJitterDeg);
    expect(r.intensity).toBeGreaterThan(0);
  });

  it('jitter é determinístico para a mesma semente/ciclo', () => {
    const a = buildPerception(moving().units.find((u) => u.id === 'cian_observer_1')!, moving(), map, cfg);
    const b = buildPerception(moving().units.find((u) => u.id === 'cian_observer_1')!, moving(), map, cfg);
    expect(a.sensors.sound[0]!.direction).toBe(b.sensors.sound[0]!.direction);
  });

  it('unidade parada é silenciosa', () => {
    const s = moving();
    s.units.find((u) => u.id === 'magenta_runner_1')!.speed = 0;
    const p = buildPerception(s.units.find((u) => u.id === 'cian_observer_1')!, s, map, cfg);
    expect(p.sensors.sound.length).toBe(0);
  });
});

describe('radar (pulse_scan)', () => {
  it('pulso custa energia, entra em cooldown e revela inimigos no raio', () => {
    let s = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [30, 24], // dist ~11,7 < raio 18, fora do cone de visão
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    const e0 = s.units.find((u) => u.id === 'cian_observer_1')!.energy;
    s = stepCycle(s, { cian_observer_1: { action: 'pulse_scan' } }, map, cfg).state;

    const obs = s.units.find((u) => u.id === 'cian_observer_1')!;
    expect(obs.energy).toBe(e0 - cfg.sensors.radarCostObserver + cfg.energyRegenPerCycle);
    expect(obs.cooldowns['pulse_scan']).toBe(cfg.sensors.radarCooldownCycles - 1);

    const perceptions = buildPerceptions(s, map, cfg);
    const mine = perceptions['cian_observer_1']!;
    const unitEchoes = mine.sensors.radar.filter((r) => r.type === 'unit');
    expect(unitEchoes.length).toBeGreaterThanOrEqual(1);
    const echo = unitEchoes[0]!;
    // Posição quantizada em células 2×2 (valores ímpares = centro do bloco).
    expect(echo.position![0]! % 2).toBe(1);
    expect(echo.position![1]! % 2).toBe(1);

    // O preço: o inimigo detecta a origem do pulso.
    const enemy = perceptions['magenta_runner_1']!;
    expect(enemy.sensors.radar.some((r) => r.type === 'pulse_origin')).toBe(true);
    expect(enemy.events).toContain('pulse_scan_detected');
  });

  it('em cooldown, o pulso não dispara nem cobra energia', () => {
    let s = place({
      cian_observer_1: [20, 18, 0],
      magenta_runner_1: [30, 24],
      cian_runner_1: [2, 2],
      magenta_observer_1: [60, 33],
    });
    s = stepCycle(s, { cian_observer_1: { action: 'pulse_scan' } }, map, cfg).state;
    const e1 = s.units.find((u) => u.id === 'cian_observer_1')!.energy;
    s = stepCycle(s, { cian_observer_1: { action: 'pulse_scan' } }, map, cfg).state;
    const obs = s.units.find((u) => u.id === 'cian_observer_1')!;
    expect(obs.energy).toBe(e1 + cfg.energyRegenPerCycle); // só regenerou
    expect(s.pulses.length).toBe(0);
  });
});

describe('comunicação', () => {
  it('mensagem enviada num ciclo chega aos aliados no seguinte', () => {
    let s = createMatch('comm-test', map, cfg);
    s = stepCycle(s, { cian_observer_1: { message_to_team: 'enemy_east' } }, map, cfg).state;
    const p = buildPerceptions(s, map, cfg);
    expect(p['cian_runner_1']!.team_messages).toEqual([
      { from: 'cian_observer_1', cycle: 0, data: 'enemy_east' },
    ]);
    // O emissor não recebe a própria mensagem; o inimigo tampouco.
    expect(p['cian_observer_1']!.team_messages).toEqual([]);
    expect(p['magenta_runner_1']!.team_messages).toEqual([]);
    // Um ciclo depois, a mensagem expira.
    s = stepCycle(s, {}, map, cfg).state;
    expect(buildPerceptions(s, map, cfg)['cian_runner_1']!.team_messages).toEqual([]);
  });

  it('zona de interferência descarta mensagens do emissor e marca aliados stale', () => {
    let s = createMatch('comm-test-2', map, cfg);
    // Move o observer cian para dentro da zona central (31.5, 17.5, r=6).
    s.units.find((u) => u.id === 'cian_observer_1')!.x = toFixed(31);
    s.units.find((u) => u.id === 'cian_observer_1')!.y = toFixed(17);
    s = stepCycle(s, { cian_observer_1: { message_to_team: 'lost_signal' } }, map, cfg).state;
    const p = buildPerceptions(s, map, cfg);
    expect(p['cian_runner_1']!.team_messages).toEqual([]); // nunca foi enfileirada
    const inZone = buildPerceptions(s, map, cfg)['cian_observer_1']!;
    expect(inZone.events).toContain('communication_interference');
    expect(inZone.allies.every((a) => a.stale === true)).toBe(true);
  });
});
