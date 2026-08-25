/**
 * E2E do servidor de partidas: sockets reais, bots reais, replay verificado.
 * Usa AgentServer diretamente (sem Nest) — o gateway apenas delega.
 */
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, hunterBot, wandererBot } from '@echo-front/agents-sdk';
import { DEFAULT_CONFIG, replayFromJsonl, resimulate } from '@echo-front/sim';
import type { MatchEndPayload } from '@echo-front/protocol';
import { AgentServer } from './agent-server.js';

const FAST_CFG = { ...DEFAULT_CONFIG, totalCycles: 12 };

function startServer(replayDir: string): Promise<{ url: string; wss: WebSocketServer; server: AgentServer }> {
  return new Promise((resolve) => {
    const server = new AgentServer();
    server.configure({ cycleMs: 40, cfg: FAST_CFG, replayDir, seedFor: (id) => `e2e-${id}` });
    const wss = new WebSocketServer({ port: 0, path: '/agent' });
    wss.on('connection', (ws) => server.attachAgentSocket(ws));
    wss.on('listening', () => {
      const addr = wss.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `ws://127.0.0.1:${port}/agent`, wss, server });
    });
  });
}

function runBotAgent(
  url: string,
  name: string,
  bot: ReturnType<typeof wandererBot>,
): { agent: Agent; done: Promise<MatchEndPayload> } {
  const agent = new Agent({
    url,
    agentName: name,
    onPerception: (unitId, p) => bot(unitId, p, 0),
  });
  const done = new Promise<MatchEndPayload>((resolve) => {
    const orig = agent['opts'].onMessage;
    agent['opts'].onMessage = (msg) => {
      orig?.(msg);
      if (msg.type === 'match_end') resolve(msg.payload);
    };
  });
  void agent.connect();
  return { agent, done };
}

describe('AgentServer e2e', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  let replayDir: string;

  beforeAll(async () => {
    replayDir = mkdtempSync(join(tmpdir(), 'echo-replays-'));
    ctx = await startServer(replayDir);
  });

  afterAll(() => ctx.wss.close());

  it('partida ao vivo wanderer × hunter termina e o replay re-simula com hash idêntico', async () => {
    const a = runBotAgent(ctx.url, 'wanderer', wandererBot());
    const b = runBotAgent(ctx.url, 'hunter', hunterBot());

    const [endA, endB] = await Promise.all([a.done, b.done]);
    a.agent.close();
    b.agent.close();

    expect(endA.finalHash).toBe(endB.finalHash);
    expect(endA.reason).toBe('time_up');

    // Replay gravado em disco re-simula até o mesmo hash.
    const files = readdirSync(replayDir).filter((f) => f.endsWith('.replay.jsonl'));
    expect(files.length).toBe(1);
    const replay = replayFromJsonl(readFileSync(join(replayDir, files[0]!), 'utf8'));
    expect(replay.finalHash).toBe(endA.finalHash);
    const final = resimulate(replay); // lança se divergir
    expect(final.ended).toBe(true);
  }, 15000);

  it('agente que cai no meio da partida não trava o loop', async () => {
    const a = runBotAgent(ctx.url, 'wanderer-2', wandererBot());
    const b = runBotAgent(ctx.url, 'hunter-2', hunterBot());

    // Derruba o wanderer após ~3 ciclos; o hunter deve receber match_end normalmente.
    setTimeout(() => a.agent.close(), 150);
    const end = await b.done;
    b.agent.close();
    expect(end.reason).toBe('time_up');
    expect(end.finalHash).toMatch(/^[0-9a-f]{16}$/);
  }, 15000);
});
