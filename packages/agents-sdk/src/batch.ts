/**
 * Avaliação em série (sprint-03): N partidas headless entre bots de referência.
 *   pnpm --filter @echo-front/agents-sdk batch -- --n 200 --botA courier --botB trickster [--csv out.csv]
 * Lados são espelhados: seeds pares A=cian, ímpares A=magenta.
 */
import { writeFileSync } from 'node:fs';
import type { Team } from '@echo-front/protocol';
import { DEFAULT_CONFIG, decideWinner, runPerceptionMatch } from '@echo-front/sim';
import { hunterBot, wandererBot, type PerceptionBotFn } from './bots.js';
import { courierBot, tricksterBot } from './objective-bots.js';
import { ghostBot, ghostConfig } from './ghost-bot.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

export function makeBot(kind: string, team: Team): PerceptionBotFn {
  switch (kind) {
    case 'courier':
      return courierBot(team);
    case 'trickster':
      return tricksterBot(team);
    case 'ghost':
      return ghostBot(team);
    case 'wanderer':
      return wandererBot();
    case 'hunter':
      return hunterBot();
    default:
      throw new Error(`bot desconhecido: ${kind}`);
  }
}

const n = Number(arg('n', '200'));
const botA = arg('botA', 'courier');
const botB = arg('botB', 'trickster');
const csvPath = arg('csv', '');
const cyclesArg = Number(arg('cycles', String(DEFAULT_CONFIG.totalCycles)));

const cfg = { ...DEFAULT_CONFIG, totalCycles: cyclesArg };
const rows: string[] = [
  'seed,sideA,winner,winnerBot,scoreCian,scoreMagenta,kills,energySpentA,energySpentB,reason',
];
let winsA = 0;
let winsB = 0;
let draws = 0;
const noKillWinsB: string[] = [];

for (let i = 0; i < n; i++) {
  const seed = `series-${i}`;
  const aTeam: Team = i % 2 === 0 ? 'cian' : 'magenta';
  const bTeam: Team = aTeam === 'cian' ? 'magenta' : 'cian';
  const bots = {
    [aTeam]: makeBot(botA, aTeam),
    [bTeam]: makeBot(botB, bTeam),
  } as { cian: PerceptionBotFn; magenta: PerceptionBotFn };

  const matchCfg = [botA, botB].includes('ghost')
    ? ghostConfig(botA === 'ghost' ? aTeam : bTeam, cfg)
    : cfg;
  const r = runPerceptionMatch({ seed, cfg: matchCfg, bots });
  const winner = decideWinner(r.finalState);
  const winnerBot = winner === 'draw' ? 'draw' : winner === aTeam ? botA : botB;
  if (winnerBot === botA) winsA++;
  else if (winnerBot === botB) winsB++;
  else draws++;

  const kills = r.finalState.units.filter((u) => !u.alive).length;
  const spent = (team: Team) =>
    r.finalState.units.filter((u) => u.team === team).reduce((acc, u) => acc + u.energySpent, 0);
  if (winnerBot === botB && kills === 0) noKillWinsB.push(seed);

  rows.push(
    `${seed},${aTeam},${winner},${winnerBot},${r.finalState.score.cian},${r.finalState.score.magenta},${kills},${spent(aTeam)},${spent(bTeam)},${r.finalState.endReason}`,
  );
}

const pct = (x: number) => ((100 * x) / n).toFixed(1);
console.log(`ECHO//FRONT batch — ${botA} × ${botB}, n=${n}, ciclos=${cfg.totalCycles}`);
console.log(
  `${botA}: ${winsA} (${pct(winsA)}%) | ${botB}: ${winsB} (${pct(winsB)}%) | empates: ${draws} (${pct(draws)}%)`,
);
console.log(
  `vitórias de ${botB} sem destruir unidades: ${noKillWinsB.length}${noKillWinsB.length ? ` (ex.: ${noKillWinsB.slice(0, 5).join(', ')})` : ''}`,
);
if (csvPath) {
  writeFileSync(csvPath, rows.join('\n') + '\n');
  console.log(`csv salvo em ${csvPath}`);
}
