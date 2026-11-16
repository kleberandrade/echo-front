import { Agent } from '../dist/index.js';
import { decide } from './decide.mjs';

let cycle = 0;
const agent = new Agent({
  url: process.env.AGENT_WS_URL ?? 'ws://localhost:3001/agent',
  agentName: process.env.AGENT_NAME ?? 'example-wanderer',
  token: process.env.AGENT_TOKEN,
  onMessage(message) {
    if (message.type === 'perception') cycle = message.cycle ?? 0;
    if (message.type === 'match_end') console.log('Match finished:', message.payload);
    if (message.type === 'error') console.error('Server error:', message.payload);
  },
  onPerception: (unitId, perception) => decide(unitId, perception, cycle),
  onWelcome: (welcome) => console.log(`Joined ${welcome.matchId} as ${welcome.team}`),
  onClose: () => console.log('Disconnected'),
});

process.once('SIGINT', () => agent.close());
process.once('SIGTERM', () => agent.close());
try {
  await agent.connect();
} catch (error) {
  console.error('Connection failed:', error.message);
  process.exitCode = 1;
}
