/**
 * Harness manual: conecta dois bots de referência a um servidor em execução
 * e joga a SÉRIE completa (o servidor informa `series.of` no welcome).
 *   pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots wanderer,hunter
 */
import { Agent } from './index.js';
import { hunterBot, wandererBot, type PerceptionBotFn } from './bots.js';
import { courierBot, tricksterBot } from './objective-bots.js';
import { ghostBot } from './ghost-bot.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function makeBot(kind: string, team: 'cian' | 'magenta'): PerceptionBotFn {
  switch (kind) {
    case 'wanderer':
      return wandererBot();
    case 'hunter':
      return hunterBot(team);
    case 'courier':
      return courierBot(team);
    case 'trickster':
      return tricksterBot(team);
    case 'ghost':
      return ghostBot(team);
    default:
      throw new Error(`bot desconhecido: ${kind}`);
  }
}

const url = arg('url', 'ws://localhost:3001/agent');
const [a = 'wanderer', b = 'hunter'] = arg('bots', 'wanderer,hunter').split(',');
const tokenA = arg('tokenA', '');
const tokenB = arg('tokenB', '');

let finishedAgents = 0;
for (const [kind, token] of [
  [a, tokenA],
  [b, tokenB],
] as const) {
  let bot: PerceptionBotFn = makeBot(kind, 'cian');
  let seriesOf = 1;
  let played = 0;
  const agent = new Agent({
    url,
    agentName: kind,
    token: token || undefined,
    onPerception: (unitId, p) => bot(unitId, p, 0),
    onMessage: (msg) => {
      if (msg.type === 'welcome') {
        bot = makeBot(kind, msg.payload.team); // reancora o time a cada partida
        seriesOf = msg.payload.series?.of ?? 1;
        console.log(
          `[${kind}] partida ${msg.payload.series?.game ?? 1}/${seriesOf} como ${msg.payload.team}`,
        );
      }
      if (msg.type === 'match_end') {
        played += 1;
        console.log(
          `[${kind}] fim ${played}/${seriesOf}: ${msg.payload.winner} ${msg.payload.score.cian}×${msg.payload.score.magenta} hash=${msg.payload.finalHash}`,
        );
        if (played >= seriesOf) {
          agent.close();
          if (++finishedAgents === 2) process.exit(0);
        }
      }
    },
  });
  void agent.connect();
}
