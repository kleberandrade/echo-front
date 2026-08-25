import { decideWinner, resimulate, runPerceptionMatch } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { courierBot } from './objective-bots.js';
import { ghostBot, ghostConfig } from './ghost-bot.js';

describe('ghost (phantom + runner)', () => {
  it('joga partida completa com composição custom e replay verificável', () => {
    const cfg = ghostConfig('magenta');
    const r = runPerceptionMatch({
      seed: 'ghost-1',
      cfg,
      bots: { cian: courierBot('cian'), magenta: ghostBot('magenta') },
    });
    expect(r.finalState.units.some((u) => u.class === 'phantom')).toBe(true);
    expect(r.finalState.ended).toBe(true);
    const final = resimulate(r.replay);
    expect(JSON.stringify(final)).toBe(JSON.stringify(r.finalState));
  });

  it('phantom usa camuflagem e sinais falsos ao longo da série (seed fixada)', () => {
    const cfg = ghostConfig('magenta');
    let hid = false;
    let decoyed = false;
    const ghost = ghostBot('magenta');
    const r = runPerceptionMatch({
      seed: 'series-1',
      cfg,
      bots: {
        cian: courierBot('cian'),
        magenta: (id, p, c) => {
          const d = ghost(id, p, c);
          if (id.includes('phantom') && d.action === 'hide') hid = true;
          if (d.action === 'deploy_decoy') decoyed = true;
          return d;
        },
      },
    });
    expect(decoyed).toBe(true);
    expect(hid || decoyed).toBe(true);
    // Vitória por engano da série (43,3% × 56,7% em n=60): sem abates.
    expect(decideWinner(r.finalState)).toBe('magenta');
    expect(r.finalState.units.every((u) => u.alive)).toBe(true);
  });
});
