import { once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@echo-front/sim';
import { parseAgentMessage } from '@echo-front/protocol';
import { AgentServer } from './match/agent-server.js';
import { startDemoAgents } from './demo-agents.js';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Demo did not reach the expected state');
    await delay(10);
  }
}

function urlOf(wss: WebSocketServer): string {
  const address = wss.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  return `ws://127.0.0.1:${address.port}`;
}

async function closeServer(wss: WebSocketServer): Promise<void> {
  for (const ws of wss.clients) ws.terminate();
  await new Promise<void>((resolve, reject) =>
    wss.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('continuous reference-agent demo', () => {
  it.each([0, -1, 0.5, 60_001, Number.NaN])(
    'rejects invalid restart delay %s',
    (restartDelayMs) => {
      expect(() => startDemoAgents('ws://127.0.0.1:3001/agent', { restartDelayMs })).toThrow(
        RangeError,
      );
    },
  );

  it('rejects a non-WebSocket URL before opening a connection', () => {
    expect(() => startDemoAgents('https://example.com/agent')).toThrow(TypeError);
  });

  it('can stop while sockets are still connecting without retrying', async () => {
    const wss = new WebSocketServer({ port: 0 });
    let connections = 0;
    wss.on('connection', () => (connections += 1));
    await once(wss, 'listening');
    const stop = startDemoAgents(`${urlOf(wss)}/agent`, { restartDelayMs: 10 });
    stop();
    try {
      await delay(80);
      expect(connections).toBe(0);
    } finally {
      stop();
      await closeServer(wss);
    }
  });

  it('plays mirrored games with decisions, starts another series, and stops reconnecting', async () => {
    const server = new AgentServer();
    server.configure({
      dataDir: '',
      databaseUrl: '',
      cycleMs: 25,
      cfg: { ...DEFAULT_CONFIG, totalCycles: 3 },
      seriesGames: 2,
      interGameMs: 10,
      agentRateLimit: null,
      spectatorRateLimit: null,
    });
    const wss = new WebSocketServer({ port: 0 });
    const names: string[] = [];
    let decisions = 0;
    wss.on('connection', (ws, request) => {
      if (request.url === '/spectate') return server.attachSpectatorSocket(ws);
      ws.on('message', (raw) => {
        const msg = parseAgentMessage(raw.toString());
        if (msg.type === 'hello') names.push(msg.payload.agentName);
        if (msg.type === 'decision') {
          expect(msg.payload.movement ?? msg.payload.action).toBeDefined();
          decisions += 1;
        }
      });
      server.attachAgentSocket(ws);
    });
    await once(wss, 'listening');
    const spectator = new WebSocket(`${urlOf(wss)}/spectate`);
    const completed: string[] = [];
    spectator.on('message', (raw) => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === 'spectate_end') completed.push(frame.matchId);
    });
    await once(spectator, 'open');
    const stop = startDemoAgents(`${urlOf(wss)}/agent`, { restartDelayMs: 40 });
    try {
      await until(() => completed.includes('s2-g2'));
      stop();
      stop();
      const connectionsAtStop = names.length;
      const decisionsAtStop = decisions;
      await delay(150);
      expect(completed.slice(0, 4)).toEqual(['s1-g1', 's1-g2', 's2-g1', 's2-g2']);
      expect(names.slice(0, 4)).toEqual([
        'demo-hunter',
        'demo-courier',
        'demo-hunter',
        'demo-courier',
      ]);
      expect(decisionsAtStop).toBeGreaterThan(0);
      expect(decisions).toBe(decisionsAtStop);
      expect(names.length).toBe(connectionsAtStop);
    } finally {
      stop();
      spectator.terminate();
      await closeServer(wss);
    }
  });

  it('retries failed handshakes as a pair with one delayed retry and cancels pending retries', async () => {
    const attempts: number[] = [];
    const wss = new WebSocketServer({
      port: 0,
      verifyClient: (_info, done) => {
        attempts.push(Date.now());
        done(false, 503, 'Unavailable');
      },
    });
    await once(wss, 'listening');
    const stop = startDemoAgents(`${urlOf(wss)}/agent`, { restartDelayMs: 60 });
    try {
      await until(() => attempts.length >= 6);
      stop();
      const atStop = attempts.length;
      await delay(150);
      expect(attempts.length).toBe(atStop);
      expect(attempts.length).toBeLessThanOrEqual(6);
      expect(attempts[2]! - attempts[0]!).toBeGreaterThanOrEqual(45);
      expect(attempts[4]! - attempts[2]!).toBeGreaterThanOrEqual(45);
    } finally {
      stop();
      await closeServer(wss);
    }
  });
});
