/**
 * E2E do servidor: série ranqueada com sockets e bots reais, resultados
 * persistidos e replays verificados (sprint-06).
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, hunterBot, wandererBot } from '@echo-front/agents-sdk';
import { DEFAULT_CONFIG, replayFromJsonl, resimulate } from '@echo-front/sim';
import type { MatchEndPayload } from '@echo-front/protocol';
import { AgentServer } from './agent-server.js';

const FAST_CFG = { ...DEFAULT_CONFIG, totalCycles: 10 };
const GAMES = 2;

function startServer(dataDir: string): Promise<{ url: string; wss: WebSocketServer; server: AgentServer }> {
  return new Promise((resolve) => {
    const server = new AgentServer();
    server.configure({
      cycleMs: 30,
      cfg: FAST_CFG,
      dataDir,
      seriesGames: GAMES,
      interGameMs: 50,
      seedFor: (sid, k) => `e2e-${sid}-${k}`,
    });
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
  games: number,
): { agent: Agent; done: Promise<MatchEndPayload[]> } {
  const ends: MatchEndPayload[] = [];
  const agent = new Agent({
    url,
    agentName: name,
    onPerception: (unitId, p) => bot(unitId, p, 0),
  });
  const done = new Promise<MatchEndPayload[]>((resolve) => {
    agent['opts'].onMessage = (msg) => {
      if (msg.type === 'match_end') {
        ends.push(msg.payload);
        if (ends.length === games) resolve(ends);
      }
    };
  });
  void agent.connect();
  return { agent, done };
}

describe('AgentServer e2e — séries ranqueadas', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'echo-data-'));
    ctx = await startServer(dataDir);
  });

  afterAll(() => ctx.wss.close());

  it('série de 2 partidas com lados espelhados, resultados persistidos e replays verificáveis', async () => {
    const a = runBotAgent(ctx.url, 'wanderer', wandererBot(), GAMES);
    const b = runBotAgent(ctx.url, 'hunter', hunterBot(), GAMES);

    const [endsA, endsB] = await Promise.all([a.done, b.done]);
    a.agent.close();
    b.agent.close();
    expect(endsA.length).toBe(GAMES);
    expect(endsA.map((e) => e.finalHash)).toEqual(endsB.map((e) => e.finalHash));

    // Aguarda a persistência do último resultado.
    await new Promise((r) => setTimeout(r, 200));
    const results = ctx.server.store!.listResults();
    expect(results.length).toBe(GAMES);
    // Lados espelhados: mesmo par, times trocados entre g1 e g2.
    expect(results[0]!.agents.cian).toBe('wanderer');
    expect(results[1]!.agents.cian).toBe('hunter');
    expect(results[0]!.seed).toBe(results[1]!.seed); // mesma semente, lados trocados

    for (const r of results) {
      const replay = replayFromJsonl(
        readFileSync(join(dataDir, 'replays', `${r.matchId}.replay.jsonl`), 'utf8'),
      );
      expect(replay.finalHash).toBe(r.finalHash);
      expect(() => resimulate(replay)).not.toThrow();
      expect(r.points.cian + r.points.magenta).toBeGreaterThan(0);
    }

    const standings = ctx.server.store!.standings();
    expect(standings.length).toBe(2);
    expect(standings.reduce((acc, s) => acc + s.matches, 0)).toBe(GAMES * 2);
  }, 30000);

  it('queda de um agente no meio da série não trava o restante', async () => {
    const a = runBotAgent(ctx.url, 'wanderer-2', wandererBot(), GAMES);
    const b = runBotAgent(ctx.url, 'hunter-2', hunterBot(), GAMES);
    setTimeout(() => a.agent.close(), 120); // cai durante a 1ª partida
    const ends = await b.done;
    b.agent.close();
    expect(ends.length).toBe(GAMES);
  }, 30000);
});
