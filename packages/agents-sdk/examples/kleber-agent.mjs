import { Agent, courierBot, vanguardBot } from '../dist/index.js';

const url = process.env.AGENT_WS_URL ?? 'wss://echo-front-server.onrender.com/agent';
const name = process.env.AGENT_NAME ?? 'kleber-vanguard';
const makeBot = process.env.AGENT_STRATEGY === 'courier' ? courierBot : vanguardBot;
let active;
let retry;
let stopping = false;

class Session {
  bot;
  cycle = 0;
  lastGame = false;

  constructor() {
    this.agent = new Agent({
      url,
      agentName: name,
      token: process.env.AGENT_TOKEN,
      onWelcome: (welcome) => this.onWelcome(welcome),
      onMessage: (message) => this.onMessage(message),
      onPerception: (id, p) => this.bot?.(id, p, this.cycle),
      onClose: () => this.onClose(),
    });
  }

  onWelcome(welcome) {
    this.bot = makeBot(welcome.team);
    this.lastGame = !welcome.series || welcome.series.game >= welcome.series.of;
    console.log(JSON.stringify({ event: 'joined', name, ...welcome }));
  }

  onMessage(message) {
    if (message.type === 'perception') this.cycle = message.cycle ?? 0;
    if (message.type === 'match_end') {
      console.log(JSON.stringify({ event: 'result', name, ...message.payload }));
      if (this.lastGame) this.agent.close();
    }
    if (message.type === 'error') console.error(JSON.stringify(message));
  }

  onClose() {
    if (active !== this.agent) return;
    active = undefined;
    console.log(JSON.stringify({ event: 'disconnected', name }));
    if (!stopping) retry = setTimeout(connect, 5000);
  }
}

function connect() {
  if (stopping) return;
  const { agent } = new Session();
  active = agent;
  console.log(JSON.stringify({ event: 'connecting', name, url }));
  void agent.connect().catch((error) => {
    console.error(JSON.stringify({ event: 'connection_error', name, message: error.message }));
    agent.close();
  });
}

function stop() {
  stopping = true;
  clearTimeout(retry);
  active?.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
connect();
