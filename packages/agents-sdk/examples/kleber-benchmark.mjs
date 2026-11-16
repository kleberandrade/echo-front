import { performance } from 'node:perf_hooks';
import { decideWinner, runPerceptionMatch } from '@echo-front/sim';
import { courierBot, hunterBot, tricksterBot, vanguardBot } from '../dist/index.js';

// Twenty held-out seeds, each played from both sides with the default composition.
let maxDecisionMs = 0;
for (const [name, makeOpponent] of Object.entries({
  hunter: hunterBot,
  courier: courierBot,
  trickster: tricksterBot,
})) {
  const tally = { opponent: name, matches: 40, wins: 0, draws: 0, losses: 0 };
  for (let i = 0; i < tally.matches; i++) {
    const team = i % 2 === 0 ? 'cian' : 'magenta';
    const bot = vanguardBot(team);
    const result = runPerceptionMatch({
      seed: `kleber-holdout-${Math.floor(i / 2)}`,
      bots: {
        cian: makeOpponent('cian'),
        magenta: makeOpponent('magenta'),
        [team]: (id, perception, cycle) => {
          const start = performance.now();
          const decision = bot(id, perception, cycle);
          maxDecisionMs = Math.max(maxDecisionMs, performance.now() - start);
          return decision;
        },
      },
    });
    const winner = decideWinner(result.finalState);
    if (winner === team) tally.wins++;
    else if (winner === 'draw') tally.draws++;
    else tally.losses++;
  }
  console.log(JSON.stringify(tally));
}
console.log(JSON.stringify({ maxDecisionMs }));
