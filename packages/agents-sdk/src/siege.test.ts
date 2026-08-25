/**
 * Sprint 9: bots multi-modo — rotina de cerco e respeito à cota de pulsos.
 */
import { DEFAULT_CONFIG, decideWinner, resimulate, runPerceptionMatch } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { courierBot, tricksterBot } from './objective-bots.js';

const SIEGE = { ...DEFAULT_CONFIG, mode: 'core_siege' as const };
const SILENT = {
  ...DEFAULT_CONFIG,
  mode: 'silent_hunt' as const,
  sensors: { ...DEFAULT_CONFIG.sensors, maxPulsesPerMatch: 2 },
};

describe('core_siege com bots de referência', () => {
  it('courier encontra e danifica o núcleo contra adversário passivo', () => {
    const idle = () => ({});
    const r = runPerceptionMatch({
      seed: 'siege-bot-1',
      cfg: SIEGE,
      bots: { cian: courierBot('cian'), magenta: idle },
    });
    // O time cian localizou o núcleo sorteado e causou dano (ou destruiu).
    expect(r.finalState.coreIntegrity.magenta).toBeLessThan(SIEGE.coreSiege.coreIntegrity);
    expect(decideWinner(r.finalState)).toBe('cian');
  });

  it('courier × trickster no cerco: partida completa, reproduzível', () => {
    const r = runPerceptionMatch({
      seed: 'siege-bot-2',
      cfg: SIEGE,
      bots: { cian: courierBot('cian'), magenta: tricksterBot('magenta') },
    });
    expect(r.finalState.ended).toBe(true);
    expect(['core_destroyed', 'time_up']).toContain(r.finalState.endReason);
    const final = resimulate(r.replay);
    expect(JSON.stringify(final)).toBe(JSON.stringify(r.finalState));
    expect(r.finalState.fragments.length).toBe(0); // sem fragmentos no cerco
  });
});

describe('silent_hunt com bots de referência', () => {
  it('bots respeitam a cota via objective.pulses_left', () => {
    const r = runPerceptionMatch({
      seed: 'silent-bot-1',
      cfg: SILENT,
      bots: { cian: courierBot('cian'), magenta: tricksterBot('magenta') },
    });
    for (const u of r.finalState.units) {
      expect(u.pulsesUsed).toBeLessThanOrEqual(SILENT.sensors.maxPulsesPerMatch);
    }
    expect(r.finalState.ended).toBe(true);
  });
});
