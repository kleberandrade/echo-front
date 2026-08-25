/**
 * Gera o replay de demonstração servido estático pelo site:
 *   node scripts/gen-demo-replay.mjs [seed]
 * Requer os pacotes buildados (pnpm build).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPerceptionMatch, replayToJsonl, decideWinner } from '@echo-front/sim';
import { courierBot, tricksterBot } from '@echo-front/agents-sdk';

const seed = process.argv[2] ?? 'series-3';
const r = runPerceptionMatch({
  seed,
  bots: { cian: courierBot('cian'), magenta: tricksterBot('magenta') },
});
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'replays');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'demo.replay.jsonl');
writeFileSync(out, replayToJsonl(r.replay));
console.log(
  `demo gerado: seed=${seed} placar=${r.finalState.score.cian}×${r.finalState.score.magenta} ` +
    `vencedor=${decideWinner(r.finalState)} hash=${r.replay.finalHash} → ${out}`,
);
