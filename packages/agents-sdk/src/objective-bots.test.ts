/**
 * Critérios de aceite da sprint-03 sobre os bots de objetivo.
 */
import { DEFAULT_CONFIG, decideWinner, resimulate, runPerceptionMatch } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { courierBot, tricksterBot } from './objective-bots.js';

const CFG = DEFAULT_CONFIG; // partida completa: 180 ciclos = 90 s

describe('courier × trickster', () => {
  it('partida completa termina com vencedor pelas regras e replay verificável', () => {
    const r = runPerceptionMatch({
      seed: 'series-3',
      cfg: CFG,
      bots: { cian: courierBot('cian'), magenta: tricksterBot('magenta') },
    });
    expect(r.finalState.ended).toBe(true);
    expect(['fragments_delivered', 'time_up']).toContain(r.finalState.endReason);
    expect(['cian', 'magenta', 'draw']).toContain(decideWinner(r.finalState));
    const final = resimulate(r.replay);
    expect(JSON.stringify(final)).toBe(JSON.stringify(r.finalState));
  });

  it('courier entrega fragmentos contra adversário passivo', () => {
    const idle = () => ({});
    const r = runPerceptionMatch({
      seed: 'delivery-1',
      cfg: CFG,
      bots: { cian: courierBot('cian'), magenta: idle },
    });
    expect(r.finalState.score.cian).toBeGreaterThanOrEqual(1);
  });

  it('trickster vence SEM destruir nenhuma unidade (engano como mecânica) — seed fixada da série', () => {
    // Descoberta pela avaliação em série (docs/balance-sprint-03.csv): series-0.
    const r = runPerceptionMatch({
      seed: 'series-0',
      cfg: CFG,
      bots: { cian: courierBot('cian'), magenta: tricksterBot('magenta') },
    });
    const winner = decideWinner(r.finalState);
    expect(winner).toBe('magenta'); // trickster
    expect(r.finalState.units.every((u) => u.alive)).toBe(true); // ninguém destruído
  });

  it('trickster de fato usa decoys na partida fixada', () => {
    let decoyed = false;
    const trickster = tricksterBot('magenta');
    runPerceptionMatch({
      seed: 'series-0',
      cfg: CFG,
      bots: {
        cian: courierBot('cian'),
        magenta: (id, p, c) => {
          const d = trickster(id, p, c);
          if (d.action === 'deploy_decoy') decoyed = true;
          return d;
        },
      },
    });
    expect(decoyed).toBe(true);
  });
});
