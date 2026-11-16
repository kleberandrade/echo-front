import { DecisionPayloadSchema, type Team } from '@echo-front/protocol';
import { decideWinner, resimulate, runPerceptionMatch } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { hunterBot } from './bots.js';
import { courierBot } from './objective-bots.js';
import { vanguardBot } from './vanguard-bot.js';

describe('Kleber Vanguard', () => {
  it.each(['cian', 'magenta'] as const)(
    'delivers three fragments from %s with valid, reproducible decisions',
    (team) => {
      const bot = vanguardBot(team);
      let decisions = 0;
      const result = runPerceptionMatch({
        seed: 'vanguard-delivery',
        bots: {
          cian: () => ({}),
          magenta: () => ({}),
          [team]: (id, p, cycle) => {
            const decision = bot(id, p, cycle);
            expect(DecisionPayloadSchema.safeParse(decision).success).toBe(true);
            decisions++;
            return decision;
          },
        },
      });
      expect(decisions).toBeGreaterThan(20);
      expect(result.finalState.score[team]).toBe(3);
      expect(resimulate(result.replay)).toEqual(result.finalState);
    },
  );

  it.each([
    ['hunter', hunterBot],
    ['courier', courierBot],
  ] as const)('wins a majority of mirrored matches against %s', (_name, opponent) => {
    let wins = 0;
    for (let i = 0; i < 12; i++) {
      const team: Team = i % 2 === 0 ? 'cian' : 'magenta';
      const enemy = team === 'cian' ? 'magenta' : 'cian';
      const result = runPerceptionMatch({
        seed: `vanguard-regression-${Math.floor(i / 2)}`,
        bots: {
          cian: vanguardBot('cian'),
          magenta: vanguardBot('magenta'),
          [enemy]: opponent(enemy),
        },
      });
      if (decideWinner(result.finalState) === team) wins++;
    }
    expect(wins).toBeGreaterThan(6);
  });
});
