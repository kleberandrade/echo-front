/**
 * Harness manual: conecta dois bots de referência a um servidor em execução.
 *   pnpm --filter @echo-front/agents-sdk match -- --url ws://localhost:3001/agent --bots wanderer,hunter
 */
import { Agent } from './index.js';
import { hunterBot, wandererBot, type PerceptionBotFn } from './bots.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function makeBot(kind: string): PerceptionBotFn {
  if (kind === 'wanderer') return wandererBot();
  if (kind === 'hunter') return hunterBot();
  throw new Error(`bot desconhecido: ${kind}`);
}

const url = arg('url', 'ws://localhost:3001/agent');
const [a = 'wanderer', b = 'hunter'] = arg('bots', 'wanderer,hunter').split(',');

let finished = 0;
for (const kind of [a, b]) {
  const bot = makeBot(kind);
  const agent = new Agent({
    url,
    agentName: kind,
    onPerception: (unitId, p) => bot(unitId, p, 0),
    onMessage: (msg) => {
      if (msg.type === 'welcome') console.log(`[${kind}] time ${msg.payload.team}`);
      if (msg.type === 'match_end') {
        console.log(`[${kind}] fim: ${JSON.stringify(msg.payload)}`);
        agent.close();
        if (++finished === 2) process.exit(0);
      }
    },
  });
  void agent.connect();
}
