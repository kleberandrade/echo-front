/**
 * CLI headless: pnpm --filter @echo-front/sim sim:run -- --seed X --bots random,random
 * Escreve o replay em stdout ou em --out <arquivo>.
 */
import { writeFileSync } from 'node:fs';
import { fromFixed } from './fixed.js';
import { ARENA_ALPHA, validateMap } from './map.js';
import { idleBot, randomBot, replayToJsonl, runMatch, type BotFn } from './match.js';
import { DEFAULT_CONFIG } from './types.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function makeBot(kind: string, team: 'cian' | 'magenta'): BotFn {
  switch (kind) {
    case 'random':
      return randomBot(team);
    case 'idle':
      return idleBot();
    default:
      throw new Error(`bot desconhecido: ${kind} (use random | idle)`);
  }
}

const seed = arg('seed', 'dev-seed-1');
const cycles = Number(arg('cycles', String(DEFAULT_CONFIG.totalCycles)));
const [botA = 'random', botB = 'random'] = arg('bots', 'random,random').split(',');
const out = arg('out', '');

const validation = validateMap(ARENA_ALPHA);
if (!validation.ok) {
  console.error('mapa inválido:', validation.errors);
  process.exit(1);
}

const cfg = { ...DEFAULT_CONFIG, totalCycles: cycles };
const started = performance.now();
const result = runMatch({
  seed,
  cfg,
  bots: { cian: makeBot(botA, 'cian'), magenta: makeBot(botB, 'magenta') },
});
const elapsed = (performance.now() - started).toFixed(1);

const { finalState } = result;
console.error(
  [
    `ECHO//FRONT sim — seed=${seed} map=${ARENA_ALPHA.id}`,
    `ciclos=${finalState.cycle} ticks=${finalState.tick} (${elapsed} ms)`,
    `finalHash=${result.replay.finalHash}`,
    ...finalState.units.map(
      (u) =>
        `  ${u.id.padEnd(20)} pos=(${fromFixed(u.x).toFixed(2)}, ${fromFixed(u.y).toFixed(2)}) energy=${u.energy} integrity=${u.integrity}`,
    ),
  ].join('\n'),
);

const jsonl = replayToJsonl(result.replay);
if (out) {
  writeFileSync(out, jsonl);
  console.error(`replay salvo em ${out}`);
} else {
  process.stdout.write(jsonl);
}
