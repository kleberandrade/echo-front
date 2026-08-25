/**
 * Partidas headless wanderer × hunter usando o motor de percepção do sim —
 * inclui a demonstração de assimetria de informação exigida pela sprint-02.
 */
import { runPerceptionMatch, resimulate, DEFAULT_CONFIG } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { hunterBot, wandererBot } from './bots.js';

const CFG = { ...DEFAULT_CONFIG, totalCycles: 60 };

describe('wanderer × hunter (headless)', () => {
  it('partida completa termina e o replay re-simula com o mesmo hash', () => {
    const wanderer = wandererBot();
    const hunter = hunterBot();
    const r = runPerceptionMatch({
      seed: 'bots-1',
      cfg: CFG,
      bots: {
        cian: (id, p, c) => wanderer(id, p, c),
        magenta: (id, p, c) => hunter(id, p, c),
      },
    });
    expect(r.finalState.ended).toBe(true);
    expect(r.finalState.cycle).toBe(CFG.totalCycles);
    const final = resimulate(r.replay);
    expect(JSON.stringify(final)).toBe(JSON.stringify(r.finalState));
  });

  it('hunter usa pulse_scan e o wanderer detecta o pulso (assimetria de informação)', () => {
    const wanderer = wandererBot();
    const hunter = hunterBot();
    let hunterPulsed = false;
    let wandererSawPulse = false;
    let wandererFled = false;

    runPerceptionMatch({
      seed: 'bots-2',
      cfg: CFG,
      bots: {
        cian: (id, p, c) => {
          if (p.sensors.radar.some((r) => r.type === 'pulse_origin')) wandererSawPulse = true;
          const d = wanderer(id, p, c);
          if ((d.debug as { mode?: string } | undefined)?.mode === 'flee') wandererFled = true;
          return d;
        },
        magenta: (id, p, c) => {
          const d = hunter(id, p, c);
          if (d.action === 'pulse_scan') hunterPulsed = true;
          return d;
        },
      },
    });

    expect(hunterPulsed).toBe(true);
    expect(wandererSawPulse).toBe(true); // o preço do radar: a presa sente o pulso
    expect(wandererFled).toBe(true);
  });

  it('bots são determinísticos: duas execuções idênticas', () => {
    const mk = () => ({
      cian: wandererBot(),
      magenta: hunterBot(),
    });
    const a = runPerceptionMatch({ seed: 'bots-3', cfg: CFG, bots: mk() });
    const b = runPerceptionMatch({ seed: 'bots-3', cfg: CFG, bots: mk() });
    expect(a.replay.finalHash).toBe(b.replay.finalHash);
  });

  it('sprint-10: hunter joga o objetivo em data_run (entrega fragmento contra oponente passivo)', () => {
    const idle = () => ({});
    const r = runPerceptionMatch({
      seed: 'hunter-objective-1',
      cfg: DEFAULT_CONFIG, // partida completa: precisa das 180 ciclos para achar e entregar
      bots: { cian: hunterBot('cian'), magenta: idle },
    });
    expect(r.finalState.score.cian).toBeGreaterThan(0);
  });

  it('hunter delega para a rotina de cerco em core_siege', () => {
    const idle = () => ({});
    const r = runPerceptionMatch({
      seed: 'hunter-siege-1',
      cfg: { ...DEFAULT_CONFIG, mode: 'core_siege' as const, totalCycles: 180 },
      bots: { cian: hunterBot('cian'), magenta: idle },
    });
    expect(r.finalState.coreIntegrity.magenta).toBeLessThan(DEFAULT_CONFIG.coreSiege.coreIntegrity);
  });
});
